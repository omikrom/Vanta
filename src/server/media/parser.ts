import path from "node:path";
import type { MediaKind } from "@/lib/types";

const releaseNoise = new RegExp(
  String.raw`\b(?:2160p|1080p|720p|480p|4k|uhd|bluray|blu-ray|brrip|web[-_. ]?dl|webrip|hdr10?|dv|x26[45]|h\.?26[45]|hevc|av1|aac|dts(?:-hd)?|atmos|proper|repack|remux|extended|unrated)\b.*$`,
  "i",
);

function humanize(value: string) {
  return value
    .replace(releaseNoise, "")
    .replace(/[._]+/g, " ")
    .replace(/\s+-\s+/g, " — ")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s+|\s+$/g, "");
}

function extractYear(value: string) {
  const match = value.match(/(?:^|[. _([])((?:19|20)\d{2})(?=$|[. _)\]])/);
  return match ? Number(match[1]) : null;
}

function sortTitle(title: string) {
  return title.replace(/^(?:the|a|an)\s+/i, "").toLocaleLowerCase();
}

export interface ParsedMediaName {
  title: string;
  sortTitle: string;
  year: number | null;
  seriesTitle: string | null;
  season: number | null;
  episode: number | null;
  artist: string | null;
  album: string | null;
  track: number | null;
}

export function parseMediaName(filePath: string, kind: MediaKind): ParsedMediaName {
  const extension = path.extname(filePath);
  const fileName = path.basename(filePath, extension);

  if (kind === "series") {
    const match = fileName.match(/^(.*?)[. _-]+S(\d{1,2})E(\d{1,3})(?:[. _-]+(.*))?$/i);
    if (match) {
      const seriesTitle = humanize(match[1]) || "Unknown series";
      const episodeTitle = humanize(match[4] ?? "") || `Episode ${Number(match[3])}`;
      return {
        title: episodeTitle,
        sortTitle: sortTitle(seriesTitle),
        year: extractYear(match[1]),
        seriesTitle,
        season: Number(match[2]),
        episode: Number(match[3]),
        artist: null,
        album: null,
        track: null,
      };
    }
  }

  if (kind === "music") {
    const relativeParts = filePath.split(path.sep);
    const album = relativeParts.at(-2) ?? null;
    const artist = relativeParts.at(-3) ?? null;
    const trackMatch = fileName.match(/^(\d{1,3})[. _-]+(.*)$/);
    const title = humanize(trackMatch?.[2] ?? fileName) || fileName;
    return {
      title,
      sortTitle: sortTitle(title),
      year: null,
      seriesTitle: null,
      season: null,
      episode: null,
      artist: artist ? humanize(artist) : null,
      album: album ? humanize(album) : null,
      track: trackMatch ? Number(trackMatch[1]) : null,
    };
  }

  const year = extractYear(fileName);
  const titleWithoutYear = year
    ? fileName.replace(new RegExp(String.raw`[. _([]${year}(?=$|[. _)\]])`), "")
    : fileName;
  const title = humanize(titleWithoutYear) || fileName;

  return {
    title,
    sortTitle: sortTitle(title),
    year,
    seriesTitle: null,
    season: null,
    episode: null,
    artist: null,
    album: null,
    track: null,
  };
}
