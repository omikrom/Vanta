import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mime from "mime-types";
import { joinRelativePath, splitRelativePath, validateEntryName, VANTA_TRASH_DIRECTORY } from "@/lib/files";
import type { FileDirectoryView, FileEntry, FileRoot, FileRootAccess, FileRootSummary, SafeUser } from "@/lib/types";
import { db } from "@/server/db";

type FileRootRow = {
  id: string;
  name: string;
  path: string;
  access: FileRootAccess;
  writable: number;
  created_at: number;
};

function isWithin(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function rejectSymlinks(rootPath: string, segments: string[]) {
  let candidate = rootPath;
  for (const segment of segments) {
    candidate = path.join(candidate, segment);
    const stats = await fs.lstat(candidate).catch(() => null);
    if (!stats) throw new Error("File or folder not found");
    if (stats.isSymbolicLink()) throw new Error("File or folder not found");
  }
}

async function storageStats(rootPath: string) {
  try {
    const stats = await fs.statfs(rootPath);
    return {
      totalBytes: stats.blocks * stats.bsize,
      freeBytes: stats.bavail * stats.bsize,
    };
  } catch {
    return { totalBytes: null, freeBytes: null };
  }
}

async function toSummary(row: FileRootRow): Promise<FileRootSummary> {
  return {
    id: row.id,
    name: row.name,
    access: row.access,
    writable: Boolean(row.writable),
    createdAt: row.created_at,
    ...(await storageStats(row.path)),
  };
}

async function toRoot(row: FileRootRow): Promise<FileRoot> {
  return { ...(await toSummary(row)), path: row.path };
}

function rootRowsFor(user: SafeUser) {
  if (user.role === "admin") {
    return db.prepare("SELECT * FROM file_roots ORDER BY created_at ASC").all() as FileRootRow[];
  }
  return db
    .prepare("SELECT * FROM file_roots WHERE access = 'shared' ORDER BY created_at ASC")
    .all() as FileRootRow[];
}

export async function getFileRootSummaries(user: SafeUser) {
  return Promise.all(rootRowsFor(user).map(toSummary));
}

export async function getAdminFileRoots() {
  const rows = db.prepare("SELECT * FROM file_roots ORDER BY created_at ASC").all() as FileRootRow[];
  return Promise.all(rows.map(toRoot));
}

export async function addFileRoot(input: {
  name: string;
  path: string;
  access: FileRootAccess;
  writable: boolean;
}) {
  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error("Use a storage name between 1 and 80 characters");
  const absolutePath = path.resolve(input.path.trim());
  const stats = await fs.stat(absolutePath).catch(() => null);
  if (!stats?.isDirectory()) throw new Error("That storage folder does not exist or Vanta cannot read it");
  const realPath = await fs.realpath(absolutePath);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO file_roots (id, name, path, access, writable, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, name, realPath, input.access, input.writable ? 1 : 0, Date.now());
  return id;
}

export function removeFileRoot(id: string) {
  db.prepare("DELETE FROM file_roots WHERE id = ?").run(id);
}

async function accessibleRoot(user: SafeUser, rootId: string) {
  const row = db.prepare("SELECT * FROM file_roots WHERE id = ?").get(rootId) as FileRootRow | undefined;
  if (!row || (user.role !== "admin" && row.access !== "shared")) {
    throw new Error("Storage location not found");
  }
  const rootPath = await fs.realpath(row.path).catch(() => null);
  if (!rootPath) throw new Error("That storage location is currently unavailable");
  return { row, rootPath };
}

async function existingPath(user: SafeUser, rootId: string, relativePath: string) {
  const { row, rootPath } = await accessibleRoot(user, rootId);
  const segments = splitRelativePath(relativePath);
  const candidate = path.resolve(rootPath, ...segments);
  if (!isWithin(rootPath, candidate)) throw new Error("Invalid file path");
  await rejectSymlinks(rootPath, segments);
  const realPath = await fs.realpath(candidate).catch(() => null);
  if (!realPath || !isWithin(rootPath, realPath)) throw new Error("File or folder not found");
  return { row, rootPath, realPath, relativePath: segments.join("/") };
}

export async function listDirectory(
  user: SafeUser,
  rootId: string,
  requestedPath = "",
): Promise<FileDirectoryView> {
  const resolved = await existingPath(user, rootId, requestedPath);
  const directoryStats = await fs.stat(resolved.realPath);
  if (!directoryStats.isDirectory()) throw new Error("That path is not a folder");
  const entries = await fs.readdir(resolved.realPath, { withFileTypes: true });
  const visible = entries.filter(
    (entry) => !entry.isSymbolicLink() && !entry.name.startsWith(".") && entry.name !== VANTA_TRASH_DIRECTORY,
  );
  const mapped = await Promise.all(
    visible.map(async (entry): Promise<FileEntry | null> => {
      const absolutePath = path.join(resolved.realPath, entry.name);
      const stats = await fs.stat(absolutePath).catch(() => null);
      if (!stats || (!stats.isDirectory() && !stats.isFile())) return null;
      return {
        name: entry.name,
        relativePath: joinRelativePath(resolved.relativePath, entry.name),
        kind: stats.isDirectory() ? "folder" : "file",
        size: stats.isFile() ? stats.size : 0,
        modifiedAt: stats.mtimeMs,
        mimeType: stats.isFile() ? mime.lookup(entry.name) || "application/octet-stream" : null,
      };
    }),
  );
  const directoryEntries = mapped.filter((entry): entry is FileEntry => Boolean(entry));
  directoryEntries.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
  });
  return {
    root: await toSummary(resolved.row),
    relativePath: resolved.relativePath,
    entries: directoryEntries,
  };
}

export async function writableDirectory(user: SafeUser, rootId: string, requestedPath = "") {
  if (user.role !== "admin") throw new Error("Only the Vanta owner can change files");
  const resolved = await existingPath(user, rootId, requestedPath);
  if (!resolved.row.writable) throw new Error("This storage location is read-only");
  const stats = await fs.stat(resolved.realPath);
  if (!stats.isDirectory()) throw new Error("That path is not a folder");
  return resolved;
}

export async function createFolder(user: SafeUser, rootId: string, parentPath: string, name: string) {
  const parent = await writableDirectory(user, rootId, parentPath);
  const folderName = validateEntryName(name);
  const target = path.join(parent.realPath, folderName);
  if (!isWithin(parent.rootPath, target)) throw new Error("Invalid folder path");
  await fs.mkdir(target);
  return joinRelativePath(parent.relativePath, folderName);
}

export async function renameEntry(user: SafeUser, rootId: string, sourcePath: string, newName: string) {
  if (user.role !== "admin") throw new Error("Only the Vanta owner can change files");
  const source = await existingPath(user, rootId, sourcePath);
  if (!source.row.writable) throw new Error("This storage location is read-only");
  if (!source.relativePath) throw new Error("The storage location itself cannot be renamed here");
  const name = validateEntryName(newName);
  const target = path.join(path.dirname(source.realPath), name);
  if (!isWithin(source.rootPath, target)) throw new Error("Invalid file path");
  const collision = await fs.stat(target).catch(() => null);
  if (collision) throw new Error("An item with that name already exists");
  await fs.rename(source.realPath, target);
  const parentPath = source.relativePath.split("/").slice(0, -1).join("/");
  return joinRelativePath(parentPath, name);
}

export async function moveEntryToTrash(user: SafeUser, rootId: string, sourcePath: string) {
  if (user.role !== "admin") throw new Error("Only the Vanta owner can change files");
  const source = await existingPath(user, rootId, sourcePath);
  if (!source.row.writable) throw new Error("This storage location is read-only");
  if (!source.relativePath) throw new Error("The storage location itself cannot be moved to trash");
  const trashDirectory = path.join(source.rootPath, VANTA_TRASH_DIRECTORY);
  await fs.mkdir(trashDirectory, { recursive: true });
  const target = path.join(
    trashDirectory,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}-${path.basename(source.realPath)}`,
  );
  await fs.rename(source.realPath, target);
  return path.basename(source.realPath);
}

export async function downloadableFile(user: SafeUser, rootId: string, requestedPath: string) {
  const resolved = await existingPath(user, rootId, requestedPath);
  const stats = await fs.stat(resolved.realPath);
  if (!stats.isFile()) throw new Error("That item is not a file");
  return {
    path: resolved.realPath,
    name: path.basename(resolved.realPath),
    size: stats.size,
    mimeType: mime.lookup(resolved.realPath) || "application/octet-stream",
  };
}
