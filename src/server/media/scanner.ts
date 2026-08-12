import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mime from "mime-types";
import type { Library, MediaKind } from "@/lib/types";
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS } from "@/server/config";
import { db } from "@/server/db";
import { parseMediaName } from "@/server/media/parser";
import { findTmdbArtwork } from "@/server/media/tmdb";

type LibraryRow = {
  id: string;
  name: string;
  kind: MediaKind;
  path: string;
  last_scanned_at: number | null;
  created_at: number;
  item_count: number;
};

function toLibrary(row: LibraryRow): Library {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    path: row.path,
    itemCount: row.item_count,
    lastScannedAt: row.last_scanned_at,
    createdAt: row.created_at,
  };
}

export function getLibraries() {
  const rows = db
    .prepare(
      `SELECT l.*, COUNT(m.id) AS item_count
       FROM libraries l
       LEFT JOIN media_items m ON m.library_id = l.id
       GROUP BY l.id
       ORDER BY l.created_at ASC`,
    )
    .all() as LibraryRow[];
  return rows.map(toLibrary);
}

export async function addLibrary(input: {
  name: string;
  kind: MediaKind;
  path: string;
}) {
  const name = input.name.trim();
  const absolutePath = path.resolve(input.path.trim());
  if (!name) throw new Error("Give this library a name");
  if (!(["movie", "series", "music"] as string[]).includes(input.kind)) {
    throw new Error("Choose a valid library type");
  }

  const stats = await fs.stat(absolutePath).catch(() => null);
  if (!stats?.isDirectory()) {
    throw new Error("That folder does not exist or Vanta cannot read it");
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO libraries (id, name, kind, path, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, name, input.kind, absolutePath, Date.now());
  return id;
}

export function removeLibrary(id: string) {
  db.prepare("DELETE FROM libraries WHERE id = ?").run(id);
}

async function* walkFiles(root: string): AsyncGenerator<string> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) yield* walkFiles(resolved);
    else if (entry.isFile()) yield resolved;
  }
}

function isAccepted(filePath: string, kind: MediaKind) {
  const extension = path.extname(filePath).toLowerCase();
  return kind === "music"
    ? AUDIO_EXTENSIONS.has(extension)
    : VIDEO_EXTENSIONS.has(extension);
}

async function firstExisting(candidates: string[]) {
  for (const candidate of candidates) {
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat?.isFile()) return candidate;
  }
  return null;
}

async function localArtwork(filePath: string) {
  const directory = path.dirname(filePath);
  const extensionless = path.join(directory, path.basename(filePath, path.extname(filePath)));
  const poster = await firstExisting([
    `${extensionless}.jpg`,
    `${extensionless}.jpeg`,
    `${extensionless}.png`,
    path.join(directory, "poster.jpg"),
    path.join(directory, "folder.jpg"),
    path.join(directory, "cover.jpg"),
  ]);
  const backdrop = await firstExisting([
    path.join(directory, "fanart.jpg"),
    path.join(directory, "backdrop.jpg"),
    path.join(directory, "background.jpg"),
  ]);
  return { poster, backdrop };
}

export async function scanLibrary(libraryId: string) {
  const library = db
    .prepare("SELECT id, name, kind, path FROM libraries WHERE id = ?")
    .get(libraryId) as Pick<LibraryRow, "id" | "name" | "kind" | "path"> | undefined;
  if (!library) throw new Error("Library not found");

  const rootStat = await fs.stat(library.path).catch(() => null);
  if (!rootStat?.isDirectory()) throw new Error("The library folder is unavailable");

  const scanStartedAt = Date.now();
  let scanned = 0;
  const metadataTargets = new Map<string, { kind: "movie" | "series"; title: string; year: number | null }>();

  const upsert = db.prepare(`
    INSERT INTO media_items (
      id, library_id, kind, title, sort_title, year, series_title, season, episode,
      artist, album, track, file_path, file_size, mime_type, poster_path,
      backdrop_path, added_at, updated_at, seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(library_id, file_path) DO UPDATE SET
      title = excluded.title,
      sort_title = excluded.sort_title,
      year = excluded.year,
      series_title = excluded.series_title,
      season = excluded.season,
      episode = excluded.episode,
      artist = excluded.artist,
      album = excluded.album,
      track = excluded.track,
      file_size = excluded.file_size,
      mime_type = excluded.mime_type,
      poster_path = COALESCE(excluded.poster_path, media_items.poster_path),
      backdrop_path = COALESCE(excluded.backdrop_path, media_items.backdrop_path),
      updated_at = excluded.updated_at,
      seen_at = excluded.seen_at
  `);

  for await (const filePath of walkFiles(library.path)) {
    if (!isAccepted(filePath, library.kind)) continue;
    const stat = await fs.stat(filePath);
    const parsed = parseMediaName(path.relative(library.path, filePath), library.kind);
    const artwork = await localArtwork(filePath);
    const now = Date.now();
    upsert.run(
      randomUUID(),
      library.id,
      library.kind,
      parsed.title,
      parsed.sortTitle,
      parsed.year,
      parsed.seriesTitle,
      parsed.season,
      parsed.episode,
      parsed.artist,
      parsed.album,
      parsed.track,
      filePath,
      stat.size,
      mime.lookup(filePath) || "application/octet-stream",
      artwork.poster,
      artwork.backdrop,
      now,
      now,
      scanStartedAt,
    );
    scanned += 1;

    if (library.kind !== "music") {
      const metadataTitle = parsed.seriesTitle ?? parsed.title;
      metadataTargets.set(`${library.kind}:${metadataTitle}:${parsed.year ?? ""}`, {
        kind: library.kind,
        title: metadataTitle,
        year: parsed.year,
      });
    }
  }

  db.transaction(() => {
    db.prepare("DELETE FROM media_items WHERE library_id = ? AND seen_at < ?").run(
      library.id,
      scanStartedAt,
    );
    db.prepare("UPDATE libraries SET last_scanned_at = ? WHERE id = ?").run(
      Date.now(),
      library.id,
    );
  })();

  if (process.env.TMDB_API_KEY) {
    for (const target of [...metadataTargets.values()].slice(0, 100)) {
      const metadata = await findTmdbArtwork(target.kind, target.title, target.year).catch(
        () => null,
      );
      if (!metadata) continue;
      if (target.kind === "series") {
        db.prepare(
          `UPDATE media_items SET poster_url = ?, backdrop_url = ?, overview = ?
           WHERE library_id = ? AND series_title = ?`,
        ).run(
          metadata.posterUrl,
          metadata.backdropUrl,
          metadata.overview,
          library.id,
          target.title,
        );
      } else {
        db.prepare(
          `UPDATE media_items SET poster_url = ?, backdrop_url = ?, overview = ?
           WHERE library_id = ? AND title = ? AND (year = ? OR (? IS NULL AND year IS NULL))`,
        ).run(
          metadata.posterUrl,
          metadata.backdropUrl,
          metadata.overview,
          library.id,
          target.title,
          target.year,
          target.year,
        );
      }
    }
  }

  return { scanned };
}
