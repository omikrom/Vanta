import "server-only";

import path from "node:path";
import type { HomeFeed, MediaItem, MediaKind } from "@/lib/types";
import { DIRECT_PLAY_EXTENSIONS } from "@/server/config";
import { db } from "@/server/db";

type MediaRow = {
  id: string;
  kind: MediaKind;
  title: string;
  sort_title: string;
  year: number | null;
  series_title: string | null;
  season: number | null;
  episode: number | null;
  artist: string | null;
  album: string | null;
  track: number | null;
  duration: number | null;
  file_path: string;
  file_size: number;
  mime_type: string;
  poster_path: string | null;
  backdrop_path: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  added_at: number;
  progress: number | null;
  progress_duration: number | null;
  completed: number | null;
};

export type PrivateMediaRow = MediaRow;

function toMediaItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    sortTitle: row.sort_title,
    year: row.year,
    seriesTitle: row.series_title,
    season: row.season,
    episode: row.episode,
    artist: row.artist,
    album: row.album,
    track: row.track,
    duration: row.duration,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    posterUrl: row.poster_path
      ? `/api/media/${row.id}/artwork?kind=poster`
      : row.poster_url,
    backdropUrl: row.backdrop_path
      ? `/api/media/${row.id}/artwork?kind=backdrop`
      : row.backdrop_url,
    overview: row.overview,
    addedAt: row.added_at,
    progress: row.progress ?? 0,
    progressDuration: row.progress_duration,
    completed: Boolean(row.completed),
    playbackMode: DIRECT_PLAY_EXTENSIONS.has(path.extname(row.file_path).toLowerCase())
      ? "direct"
      : "hls",
  };
}

function mediaSelect(userId: string) {
  return db.prepare(`
    SELECT m.*,
      COALESCE(p.position, 0) AS progress,
      p.duration AS progress_duration,
      COALESCE(p.completed, 0) AS completed
    FROM media_items m
    LEFT JOIN playback_progress p ON p.media_id = m.id AND p.user_id = ?
  `).all(userId) as MediaRow[];
}

export function getAllMedia(userId: string) {
  return mediaSelect(userId).map(toMediaItem);
}

export function getHomeFeed(userId: string): HomeFeed {
  const all = getAllMedia(userId);
  const byAdded = [...all].sort((a, b) => b.addedAt - a.addedAt);
  const continueWatching = all
    .filter((item) => item.progress > 15 && !item.completed)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 16);
  const movies = all
    .filter((item) => item.kind === "movie")
    .sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));
  const series = all
    .filter((item) => item.kind === "series")
    .sort((a, b) => {
      const seriesOrder = (a.seriesTitle ?? a.title).localeCompare(b.seriesTitle ?? b.title);
      return seriesOrder || (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0);
    });
  const music = all
    .filter((item) => item.kind === "music")
    .sort((a, b) => (a.artist ?? "").localeCompare(b.artist ?? "") || a.sortTitle.localeCompare(b.sortTitle));

  return {
    featured: continueWatching[0] ?? byAdded.find((item) => item.kind !== "music") ?? byAdded[0] ?? null,
    continueWatching,
    recentlyAdded: byAdded.slice(0, 20),
    movies,
    series,
    music,
  };
}

export function getPrivateMedia(mediaId: string) {
  return db.prepare("SELECT * FROM media_items WHERE id = ?").get(mediaId) as
    | PrivateMediaRow
    | undefined;
}

export function updateProgress(
  userId: string,
  mediaId: string,
  position: number,
  duration: number | null,
) {
  const safePosition = Math.max(0, Math.round(position * 10) / 10);
  const safeDuration = duration && duration > 0 ? Math.round(duration * 10) / 10 : null;
  const completed = safeDuration ? safePosition / safeDuration >= 0.92 : false;
  db.prepare(
    `INSERT INTO playback_progress (user_id, media_id, position, duration, completed, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, media_id) DO UPDATE SET
       position = excluded.position,
       duration = excluded.duration,
       completed = excluded.completed,
       updated_at = excluded.updated_at`,
  ).run(userId, mediaId, safePosition, safeDuration, completed ? 1 : 0, Date.now());
}
