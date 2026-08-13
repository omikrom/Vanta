export type MediaKind = "movie" | "series" | "music";

export interface SafeUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "viewer";
}

export interface MediaItem {
  id: string;
  kind: MediaKind;
  title: string;
  sortTitle: string;
  year: number | null;
  seriesTitle: string | null;
  season: number | null;
  episode: number | null;
  artist: string | null;
  album: string | null;
  track: number | null;
  duration: number | null;
  fileSize: number;
  mimeType: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string | null;
  addedAt: number;
  progress: number;
  progressDuration: number | null;
  completed: boolean;
  playbackMode: "direct" | "hls";
}

export interface Library {
  id: string;
  name: string;
  kind: MediaKind;
  path: string;
  itemCount: number;
  lastScannedAt: number | null;
  createdAt: number;
}

export interface HomeFeed {
  featured: MediaItem | null;
  continueWatching: MediaItem[];
  recentlyAdded: MediaItem[];
  movies: MediaItem[];
  series: MediaItem[];
  music: MediaItem[];
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  channel: string;
  duration: number | null;
  thumbnailUrl: string | null;
  url: string;
}

export type FileRootAccess = "private" | "shared";

export interface FileRootSummary {
  id: string;
  name: string;
  access: FileRootAccess;
  writable: boolean;
  totalBytes: number | null;
  freeBytes: number | null;
  createdAt: number;
}

export interface FileRoot extends FileRootSummary {
  path: string;
}

export interface FileEntry {
  name: string;
  relativePath: string;
  kind: "folder" | "file";
  size: number;
  modifiedAt: number;
  mimeType: string | null;
}

export interface FileDirectoryView {
  root: FileRootSummary;
  relativePath: string;
  entries: FileEntry[];
}
