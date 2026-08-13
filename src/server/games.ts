import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { acceptsGameExtension, cleanGameTitle, GAME_SYSTEMS, gameSystem, stableGameStorageId, type GameSystem } from "@/lib/games";
import type { ArcadeFeed, GameItem, GameLibrary, PlayableGame } from "@/lib/types";
import { DATA_DIR } from "@/server/config";
import { db } from "@/server/db";

type GameLibraryRow = {
  id: string;
  name: string;
  system: GameSystem;
  path: string;
  bios_path: string | null;
  last_scanned_at: number | null;
  created_at: number;
  item_count: number;
};

type GameRow = {
  id: string;
  library_id: string;
  library_name: string;
  library_path: string;
  system: GameSystem;
  title: string;
  file_path: string;
  file_size: number;
  extension: string;
  cover_path: string | null;
  background_path: string | null;
  added_at: number;
  last_played_at: number | null;
  play_count: number | null;
  favorite: number | null;
  bios_path: string | null;
};

const DEMO_URL = "https://s3.amazonaws.com/nes-starter-kit/main/starter.latest.nes";
const DEMO_SHA256 = "ae51e57252258f3e331b98255007d4796a4fe83bc28700325eda0a402c7ec98d";

function toLibrary(row: GameLibraryRow): GameLibrary {
  return {
    id: row.id,
    name: row.name,
    system: row.system,
    path: row.path,
    biosPath: row.bios_path,
    itemCount: row.item_count,
    lastScannedAt: row.last_scanned_at,
    createdAt: row.created_at,
  };
}

function toGame(row: GameRow): GameItem {
  const system = gameSystem(row.system);
  return {
    id: row.id,
    libraryId: row.library_id,
    libraryName: row.library_name,
    title: row.title,
    system: row.system,
    systemLabel: system?.shortLabel ?? row.system,
    extension: row.extension,
    fileSize: row.file_size,
    coverUrl: row.cover_path ? `/api/games/${row.id}/artwork` : null,
    backgroundUrl: row.background_path ? `/api/games/${row.id}/artwork?kind=background` : null,
    addedAt: row.added_at,
    lastPlayedAt: row.last_played_at,
    playCount: row.play_count ?? 0,
    favorite: Boolean(row.favorite),
  };
}

function gameSelect(userId: string) {
  return db.prepare(`
    SELECT g.*, l.name AS library_name, l.path AS library_path, l.system, l.bios_path,
      a.last_played_at, a.play_count, a.favorite
    FROM game_items g
    JOIN game_libraries l ON l.id = g.library_id
    LEFT JOIN game_activity a ON a.game_id = g.id AND a.user_id = ?
  `).all(userId) as GameRow[];
}

export function getGameLibraries() {
  const rows = db.prepare(`
    SELECT l.*, COUNT(g.id) AS item_count
    FROM game_libraries l
    LEFT JOIN game_items g ON g.library_id = l.id
    GROUP BY l.id
    ORDER BY l.created_at ASC
  `).all() as GameLibraryRow[];
  return rows.map(toLibrary);
}

export async function addGameLibrary(input: {
  name: string;
  system: string;
  path: string;
  biosPath?: string | null;
}) {
  const name = input.name.trim();
  const system = gameSystem(input.system);
  if (!name || name.length > 80) throw new Error("Give this arcade library a short name");
  if (!system) throw new Error("Choose a supported game system");

  const absolutePath = path.resolve(input.path.trim());
  const stats = await fs.stat(absolutePath).catch(() => null);
  if (!stats?.isDirectory()) throw new Error("That ROM folder does not exist or Vanta cannot read it");
  const realPath = await fs.realpath(absolutePath);

  let biosPath: string | null = null;
  if (input.biosPath?.trim()) {
    const requestedBios = path.resolve(input.biosPath.trim());
    const biosStats = await fs.stat(requestedBios).catch(() => null);
    if (!biosStats?.isFile()) throw new Error("That BIOS file does not exist or Vanta cannot read it");
    biosPath = await fs.realpath(requestedBios);
  }

  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO game_libraries (id, name, system, path, bios_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, system.id, realPath, biosPath, Date.now());
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new Error("That ROM folder is already connected to Vanta");
    }
    throw error;
  }
  return id;
}

export function removeGameLibrary(id: string) {
  db.prepare("DELETE FROM game_libraries WHERE id = ?").run(id);
}

async function* walkRomFiles(root: string): AsyncGenerator<string> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) yield* walkRomFiles(candidate);
    else if (entry.isFile()) yield candidate;
  }
}

async function firstFile(candidates: string[]) {
  for (const candidate of candidates) {
    const stats = await fs.lstat(candidate).catch(() => null);
    if (stats?.isFile() && !stats.isSymbolicLink()) return candidate;
  }
  return null;
}

async function artworkFor(filePath: string) {
  const directory = path.dirname(filePath);
  const stem = path.join(directory, path.basename(filePath, path.extname(filePath)));
  const cover = await firstFile([
    `${stem}.jpg`, `${stem}.jpeg`, `${stem}.png`, `${stem}.webp`,
    path.join(directory, "cover.jpg"), path.join(directory, "cover.png"), path.join(directory, "folder.jpg"),
  ]);
  const background = await firstFile([
    `${stem}-background.jpg`, `${stem}-fanart.jpg`,
    path.join(directory, "background.jpg"), path.join(directory, "fanart.jpg"),
  ]);
  return { cover, background };
}

export async function scanGameLibrary(libraryId: string) {
  const library = db.prepare("SELECT id, name, system, path FROM game_libraries WHERE id = ?")
    .get(libraryId) as Pick<GameLibraryRow, "id" | "name" | "system" | "path"> | undefined;
  if (!library || !gameSystem(library.system)) throw new Error("Arcade library not found");
  const stats = await fs.stat(library.path).catch(() => null);
  if (!stats?.isDirectory()) throw new Error("The ROM folder is unavailable");

  const scanStartedAt = Date.now();
  let scanned = 0;
  const upsert = db.prepare(`
    INSERT INTO game_items (
      id, library_id, title, sort_title, file_path, file_size, extension,
      cover_path, background_path, added_at, updated_at, seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(library_id, file_path) DO UPDATE SET
      title = excluded.title,
      sort_title = excluded.sort_title,
      file_size = excluded.file_size,
      extension = excluded.extension,
      cover_path = excluded.cover_path,
      background_path = excluded.background_path,
      updated_at = excluded.updated_at,
      seen_at = excluded.seen_at
  `);

  for await (const filePath of walkRomFiles(library.path)) {
    const extension = path.extname(filePath).toLowerCase();
    if (!acceptsGameExtension(library.system, extension)) continue;
    const fileStats = await fs.stat(filePath);
    const title = cleanGameTitle(path.basename(filePath));
    const artwork = await artworkFor(filePath);
    const now = Date.now();
    upsert.run(
      randomUUID(), library.id, title, title.toLocaleLowerCase(), filePath,
      fileStats.size, extension.slice(1).toUpperCase(), artwork.cover, artwork.background,
      now, now, scanStartedAt,
    );
    scanned += 1;
  }

  db.transaction(() => {
    db.prepare("DELETE FROM game_items WHERE library_id = ? AND seen_at < ?").run(library.id, scanStartedAt);
    db.prepare("UPDATE game_libraries SET last_scanned_at = ? WHERE id = ?").run(Date.now(), library.id);
  })();
  return { scanned };
}

export function getArcadeFeed(userId: string): ArcadeFeed {
  const games = gameSelect(userId).map(toGame).sort((left, right) => left.title.localeCompare(right.title, undefined, { numeric: true }));
  return {
    games,
    recentlyPlayed: games.filter((game) => game.lastPlayedAt).sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0)).slice(0, 12),
    favorites: games.filter((game) => game.favorite),
  };
}

export function getPlayableGame(userId: string, gameId: string): PlayableGame | null {
  const row = db.prepare(`
    SELECT g.*, l.name AS library_name, l.path AS library_path, l.system, l.bios_path,
      a.last_played_at, a.play_count, a.favorite
    FROM game_items g
    JOIN game_libraries l ON l.id = g.library_id
    LEFT JOIN game_activity a ON a.game_id = g.id AND a.user_id = ?
    WHERE g.id = ?
  `).get(userId, gameId) as GameRow | undefined;
  if (!row) return null;
  return {
    ...toGame(row),
    romUrl: `/api/games/${row.id}/rom`,
    biosUrl: row.bios_path ? `/api/game-libraries/${row.library_id}/bios` : null,
    storageId: stableGameStorageId(userId, row.id),
  };
}

export function getPrivateGame(gameId: string) {
  return db.prepare(`
    SELECT g.*, l.name AS library_name, l.path AS library_path, l.system, l.bios_path,
      NULL AS last_played_at, NULL AS play_count, NULL AS favorite
    FROM game_items g JOIN game_libraries l ON l.id = g.library_id
    WHERE g.id = ?
  `).get(gameId) as GameRow | undefined;
}

export function getPrivateGameLibrary(libraryId: string) {
  return db.prepare("SELECT * FROM game_libraries WHERE id = ?").get(libraryId) as GameLibraryRow | undefined;
}

function isWithin(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

async function resolveUnchangedFile(storedPath: string, rootPath?: string) {
  const expectedPath = path.resolve(storedPath);
  const [stats, realPath] = await Promise.all([
    fs.lstat(expectedPath).catch(() => null),
    fs.realpath(expectedPath).catch(() => null),
  ]);
  if (!stats?.isFile() || stats.isSymbolicLink() || realPath !== expectedPath) return null;

  if (rootPath) {
    const expectedRoot = path.resolve(rootPath);
    const realRoot = await fs.realpath(expectedRoot).catch(() => null);
    if (realRoot !== expectedRoot || !isWithin(expectedRoot, realPath)) return null;
  }
  return { path: realPath, size: stats.size };
}

export async function resolvePrivateGameAsset(gameId: string, kind: "rom" | "cover" | "background") {
  const game = getPrivateGame(gameId);
  if (!game) return null;
  const storedPath = kind === "rom"
    ? game.file_path
    : kind === "background"
      ? game.background_path
      : game.cover_path;
  if (!storedPath) return null;
  const file = await resolveUnchangedFile(storedPath, game.library_path);
  return file ? { game, file } : null;
}

export async function resolvePrivateGameBios(libraryId: string) {
  const library = getPrivateGameLibrary(libraryId);
  if (!library?.bios_path) return null;
  const file = await resolveUnchangedFile(library.bios_path);
  return file ? { library, file } : null;
}

export function recordGameLaunch(userId: string, gameId: string) {
  const exists = db.prepare("SELECT 1 FROM game_items WHERE id = ?").get(gameId);
  if (!exists) throw new Error("Game not found");
  db.prepare(`
    INSERT INTO game_activity (user_id, game_id, last_played_at, play_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(user_id, game_id) DO UPDATE SET
      last_played_at = excluded.last_played_at,
      play_count = game_activity.play_count + 1
  `).run(userId, gameId, Date.now());
}

export function setGameFavorite(userId: string, gameId: string, favorite: boolean) {
  const exists = db.prepare("SELECT 1 FROM game_items WHERE id = ?").get(gameId);
  if (!exists) throw new Error("Game not found");
  db.prepare(`
    INSERT INTO game_activity (user_id, game_id, favorite)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, game_id) DO UPDATE SET favorite = excluded.favorite
  `).run(userId, gameId, favorite ? 1 : 0);
}

export async function installDemoGameLibrary() {
  const demoDirectory = path.join(DATA_DIR, "demo-roms", "nes-starter-kit");
  const romPath = path.join(demoDirectory, "NES Starter Quest.nes");
  await fs.mkdir(demoDirectory, { recursive: true });
  let contents = await fs.readFile(romPath).catch(() => null);
  if (!contents || createHash("sha256").update(contents).digest("hex") !== DEMO_SHA256) {
    const response = await fetch(DEMO_URL, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("The free demo ROM could not be downloaded");
    const advertisedSize = Number(response.headers.get("content-length") ?? 0);
    if (advertisedSize > 1_000_000) throw new Error("The demo ROM download was unexpectedly large");
    contents = Buffer.from(await response.arrayBuffer());
    if (contents.length > 1_000_000 || createHash("sha256").update(contents).digest("hex") !== DEMO_SHA256) {
      throw new Error("The demo ROM failed its integrity check");
    }
    await fs.writeFile(romPath, contents, { mode: 0o640 });
    await fs.writeFile(path.join(demoDirectory, "SOURCE.txt"), [
      "NES Starter Kit example game",
      "Source: https://github.com/igwgames/nes-starter-kit",
      `ROM: ${DEMO_URL}`,
      "Code: MIT License. Bundled art/music resources: CC0.",
      `SHA-256: ${DEMO_SHA256}`,
      "Installed by Vanta as a legal emulator demonstration; no commercial ROMs are included.",
      "",
    ].join("\n"));
  }

  const existing = db.prepare("SELECT id FROM game_libraries WHERE path = ?").get(demoDirectory) as { id: string } | undefined;
  const id = existing?.id ?? await addGameLibrary({ name: "NES Starter Quest", system: "nes", path: demoDirectory });
  const result = await scanGameLibrary(id);
  return { id, ...result };
}

export const supportedGameSystems = GAME_SYSTEMS;
