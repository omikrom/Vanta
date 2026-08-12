import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  parseYouTubeSearch,
  safePathPart,
  YOUTUBE_VIDEO_ID_PATTERN,
} from "@/lib/youtube";
import { db } from "@/server/db";
import { scanLibrary } from "@/server/media/scanner";

type MusicLibraryRow = {
  id: string;
  name: string;
  kind: "music";
  path: string;
  last_scanned_at: number | null;
  created_at: number;
};

async function runYtDlp(args: string[], timeoutMs: number) {
  return new Promise<string>((resolve, reject) => {
    const executable = process.env.YTDLP_PATH ?? "yt-dlp";
    const child = spawn(/* turbopackIgnore: true */ executable, [
      "--ignore-config",
      "--js-runtimes",
      "node",
      ...args,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("YouTube took too long to respond")));
    }, timeoutMs);
    timer.unref();

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.length > 3_000_000) {
        child.kill("SIGKILL");
        finish(() => reject(new Error("YouTube returned too much data")));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-8_000);
    });
    child.once("error", (error) => {
      finish(() => reject(new Error(
        error.message.includes("ENOENT")
          ? "yt-dlp is not installed or YTDLP_PATH is incorrect"
          : error.message,
      )));
    });
    child.once("exit", (code) => {
      finish(() => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      });
    });
  });
}

export async function searchYouTube(query: string) {
  const output = await runYtDlp([
    "--no-warnings",
    "--quiet",
    "--dump-single-json",
    "--flat-playlist",
    "--playlist-end",
    "12",
    `ytsearch12:${query}`,
  ], 45_000);

  try {
    return parseYouTubeSearch(JSON.parse(output));
  } catch {
    throw new Error("YouTube returned an unreadable search response");
  }
}

export async function importYouTubeAudio(input: {
  videoId: string;
  libraryId: string;
  artist: string;
  album: string;
  title: string;
}) {
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(input.videoId)) throw new Error("Invalid YouTube video");
  const library = db.prepare(
    "SELECT id, name, kind, path, last_scanned_at, created_at FROM libraries WHERE id = ? AND kind = 'music'",
  ).get(input.libraryId) as MusicLibraryRow | undefined;
  if (!library) throw new Error("Choose a valid music library");

  const artist = safePathPart(input.artist, "Unknown Artist");
  const album = safePathPart(input.album, "YouTube Imports");
  const title = safePathPart(input.title, `YouTube ${input.videoId}`);
  const targetDirectory = path.join(library.path, artist, album);
  const relative = path.relative(library.path, targetDirectory);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("The import path is outside this music library");
  }

  await fs.mkdir(targetDirectory, { recursive: true });
  const existing = await fs.readdir(targetDirectory).catch(() => []);
  if (existing.some((file) => path.parse(file).name.toLocaleLowerCase() === title.toLocaleLowerCase())) {
    throw new Error("A track with that title already exists in this artist and album");
  }

  const outputTemplate = path.join(targetDirectory, `${title}.%(ext)s`);
  const output = await runYtDlp([
    "--no-playlist",
    "--no-overwrites",
    "--no-progress",
    "--extract-audio",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",
    "--embed-metadata",
    "--write-thumbnail",
    "--convert-thumbnails",
    "jpg",
    "--embed-thumbnail",
    "--output",
    outputTemplate,
    "--print",
    "after_move:filepath",
    `https://www.youtube.com/watch?v=${input.videoId}`,
  ], 15 * 60_000);

  const importedPath = output.split(/\r?\n/).filter(Boolean).at(-1) ?? path.join(targetDirectory, `${title}.mp3`);
  await scanLibrary(library.id);
  return {
    title,
    artist,
    album,
    fileName: path.basename(importedPath),
  };
}
