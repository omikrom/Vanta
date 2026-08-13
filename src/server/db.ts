import "server-only";

import fs from "node:fs";
import Database from "better-sqlite3";
import { DATA_DIR, DATABASE_PATH } from "@/server/config";

const globalForDatabase = globalThis as unknown as {
  vantaDatabase?: Database.Database;
};

function openDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const database = new Database(DATABASE_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS libraries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('movie', 'series', 'music')),
      path TEXT NOT NULL UNIQUE,
      last_scanned_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_items (
      id TEXT PRIMARY KEY,
      library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('movie', 'series', 'music')),
      title TEXT NOT NULL,
      sort_title TEXT NOT NULL,
      year INTEGER,
      series_title TEXT,
      season INTEGER,
      episode INTEGER,
      artist TEXT,
      album TEXT,
      track INTEGER,
      duration REAL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      poster_path TEXT,
      backdrop_path TEXT,
      poster_url TEXT,
      backdrop_url TEXT,
      overview TEXT,
      added_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      seen_at INTEGER NOT NULL,
      UNIQUE(library_id, file_path)
    );

    CREATE INDEX IF NOT EXISTS media_kind_idx ON media_items(kind);
    CREATE INDEX IF NOT EXISTS media_added_idx ON media_items(added_at DESC);
    CREATE INDEX IF NOT EXISTS media_series_idx ON media_items(series_title, season, episode);

    CREATE TABLE IF NOT EXISTS playback_progress (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      position REAL NOT NULL DEFAULT 0,
      duration REAL,
      completed INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, media_id)
    );

    CREATE TABLE IF NOT EXISTS file_roots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      access TEXT NOT NULL DEFAULT 'private' CHECK(access IN ('private', 'shared')),
      writable INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS file_roots_access_idx ON file_roots(access);

    CREATE TABLE IF NOT EXISTS game_libraries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      bios_path TEXT,
      last_scanned_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_items (
      id TEXT PRIMARY KEY,
      library_id TEXT NOT NULL REFERENCES game_libraries(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      sort_title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      extension TEXT NOT NULL,
      cover_path TEXT,
      background_path TEXT,
      added_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      seen_at INTEGER NOT NULL,
      UNIQUE(library_id, file_path)
    );

    CREATE INDEX IF NOT EXISTS game_items_library_idx ON game_items(library_id);
    CREATE INDEX IF NOT EXISTS game_items_sort_idx ON game_items(sort_title);

    CREATE TABLE IF NOT EXISTS game_activity (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL REFERENCES game_items(id) ON DELETE CASCADE,
      last_played_at INTEGER,
      play_count INTEGER NOT NULL DEFAULT 0,
      favorite INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(user_id, game_id)
    );

    CREATE INDEX IF NOT EXISTS game_activity_recent_idx ON game_activity(user_id, last_played_at DESC);

    CREATE TABLE IF NOT EXISTS watch_rooms (
      id TEXT PRIMARY KEY,
      host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'playing', 'paused', 'ended')),
      control_mode TEXT NOT NULL DEFAULT 'host' CHECK(control_mode IN ('host', 'everyone')),
      position REAL NOT NULL DEFAULT 0,
      duration REAL,
      state_updated_at INTEGER NOT NULL,
      play_at INTEGER,
      created_at INTEGER NOT NULL,
      ended_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS watch_room_invites (
      room_id TEXT NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invited_at INTEGER NOT NULL,
      PRIMARY KEY(room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS watch_room_members (
      room_id TEXT NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ready INTEGER NOT NULL DEFAULT 0,
      playback_state TEXT NOT NULL DEFAULT 'joining' CHECK(playback_state IN ('joining', 'ready', 'playing', 'paused', 'buffering')),
      last_position REAL NOT NULL DEFAULT 0,
      last_seen_at INTEGER NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY(room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS watch_room_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('message', 'reaction')),
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS watch_rooms_active_idx ON watch_rooms(ended_at, created_at DESC);
    CREATE INDEX IF NOT EXISTS watch_room_invites_user_idx ON watch_room_invites(user_id, room_id);
    CREATE INDEX IF NOT EXISTS watch_room_messages_room_idx ON watch_room_messages(room_id, created_at DESC);
  `);

  return database;
}

export const db = globalForDatabase.vantaDatabase ?? openDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.vantaDatabase = db;
}

export function pruneExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
}
