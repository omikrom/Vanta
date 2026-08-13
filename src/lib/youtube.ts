import type { YouTubeSearchResult } from "@/lib/types";

type YtDlpEntry = {
  id?: unknown;
  title?: unknown;
  uploader?: unknown;
  channel?: unknown;
  duration?: unknown;
  thumbnail?: unknown;
  thumbnails?: Array<{ url?: unknown }>;
};

type YtDlpSearch = { entries?: YtDlpEntry[] };

export const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function safePathPart(input: string, fallback: string) {
  const cleaned = input
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[ .]+|[ .]+$/g, "")
    .slice(0, 100)
    .trim();
  if (!cleaned || cleaned === "." || cleaned === ".." || WINDOWS_RESERVED.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}

function cleanThumbnail(entry: YtDlpEntry) {
  const candidates = [
    ...(Array.isArray(entry.thumbnails) ? entry.thumbnails.map((item) => item.url) : []),
    entry.thumbnail,
  ];
  const match = candidates.reverse().find((value) => {
    if (typeof value !== "string") return false;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  });
  return typeof match === "string" ? match : null;
}

export function parseYouTubeSearch(payload: unknown): YouTubeSearchResult[] {
  const entries = (payload as YtDlpSearch | null)?.entries;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (typeof entry.id !== "string" || !YOUTUBE_VIDEO_ID_PATTERN.test(entry.id)) return [];
    if (typeof entry.title !== "string" || !entry.title.trim()) return [];
    const channel =
      typeof entry.channel === "string"
        ? entry.channel
        : typeof entry.uploader === "string"
          ? entry.uploader
          : "YouTube";
    return [{
      id: entry.id,
      title: entry.title.trim(),
      channel: channel.trim() || "YouTube",
      duration: typeof entry.duration === "number" && Number.isFinite(entry.duration)
        ? entry.duration
        : null,
      thumbnailUrl: cleanThumbnail(entry),
      url: `https://www.youtube.com/watch?v=${entry.id}`,
    }];
  });
}
