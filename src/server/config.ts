import "server-only";

import path from "node:path";

export const DATA_DIR = path.resolve(/* turbopackIgnore: true */
  process.env.VANTA_DATA_DIR ?? path.join(process.cwd(), "data"),
);

export const CACHE_DIR = path.resolve(/* turbopackIgnore: true */
  process.env.VANTA_CACHE_DIR ?? path.join(DATA_DIR, "cache"),
);

export const DATABASE_PATH = path.join(DATA_DIR, "vanta.db");
export const SESSION_COOKIE = "vanta_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const configuredUploadLimit = Number(process.env.VANTA_MAX_UPLOAD_BYTES);
export const MAX_UPLOAD_BYTES = Number.isFinite(configuredUploadLimit) && configuredUploadLimit > 0
  ? configuredUploadLimit
  : 20 * 1024 ** 3;

export const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".m4v",
  ".mkv",
  ".webm",
  ".mov",
  ".avi",
  ".wmv",
  ".mpeg",
  ".mpg",
  ".ts",
  ".m2ts",
]);

export const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".aac",
  ".flac",
  ".ogg",
  ".opus",
  ".wav",
  ".wma",
]);

export const DIRECT_PLAY_EXTENSIONS = new Set([
  ".mp4",
  ".m4v",
  ".webm",
  ".mp3",
  ".m4a",
  ".aac",
  ".ogg",
  ".opus",
  ".wav",
  ".flac",
]);
