import "server-only";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { CACHE_DIR } from "@/server/config";

type TranscodeState = { process: ReturnType<typeof spawn>; error: string | null };
const globalTranscodes = globalThis as unknown as {
  vantaTranscodes?: Map<string, TranscodeState>;
};

const transcodes = globalTranscodes.vantaTranscodes ?? new Map<string, TranscodeState>();
if (process.env.NODE_ENV !== "production") globalTranscodes.vantaTranscodes = transcodes;

export function parseRange(rangeHeader: string | null, size: number) {
  if (!rangeHeader) return null;
  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : NaN;
  let end = match[2] ? Number(match[2]) : NaN;

  if (Number.isNaN(start) && Number.isFinite(end)) {
    start = Math.max(size - end, 0);
    end = size - 1;
  } else {
    if (Number.isNaN(start)) return null;
    if (Number.isNaN(end)) end = size - 1;
  }

  if (start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function transcodeKey(mediaId: string, stats: fs.Stats) {
  return `${mediaId}-${Math.floor(stats.mtimeMs)}-${stats.size}`;
}

export async function ensureHls(mediaId: string, sourcePath: string) {
  const stats = await fsp.stat(sourcePath);
  const key = transcodeKey(mediaId, stats);
  const outputDirectory = path.join(CACHE_DIR, "transcodes", key);
  const manifestPath = path.join(outputDirectory, "index.m3u8");
  await fsp.mkdir(outputDirectory, { recursive: true });

  if (await fsp.stat(manifestPath).then(() => true).catch(() => false)) {
    return key;
  }

  const existing = transcodes.get(key);
  if (!existing) {
    const ffmpeg = spawn(/* turbopackIgnore: true */
      process.env.FFMPEG_PATH ?? "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        sourcePath,
        "-map",
        "0:v:0?",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        process.env.VANTA_TRANSCODE_PRESET ?? "veryfast",
        "-crf",
        process.env.VANTA_TRANSCODE_CRF ?? "21",
        "-c:a",
        "aac",
        "-ac",
        "2",
        "-b:a",
        "192k",
        "-f",
        "hls",
        "-hls_time",
        "6",
        "-hls_list_size",
        "0",
        "-hls_flags",
        "independent_segments+temp_file",
        "-hls_segment_filename",
        path.join(outputDirectory, "segment-%05d.ts"),
        manifestPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    const state: TranscodeState = { process: ffmpeg, error: null };
    transcodes.set(key, state);
    let stderr = "";
    ffmpeg.stderr?.on("data", (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-4_000);
    });
    ffmpeg.once("error", (error) => {
      state.error = error.message.includes("ENOENT")
        ? "FFmpeg is not installed or FFMPEG_PATH is incorrect"
        : error.message;
    });
    ffmpeg.once("exit", (code) => {
      if (code && !state.error) state.error = stderr || `FFmpeg exited with code ${code}`;
      setTimeout(() => transcodes.delete(key), 30_000).unref();
    });
  }

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const state = transcodes.get(key);
    if (state?.error) throw new Error(state.error);
    if (await fsp.stat(manifestPath).then(() => true).catch(() => false)) return key;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("FFmpeg did not produce a playable stream in time");
}

export function getTranscodeFile(key: string, fileName: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(key)) return null;
  if (!/^(?:index\.m3u8|segment-\d{5}\.ts)$/.test(fileName)) return null;
  const filePath = path.join(CACHE_DIR, "transcodes", key, fileName);
  return filePath;
}
