import "server-only";

type TmdbSearchResult = {
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
};

type TmdbResponse = { results?: TmdbSearchResult[] };

export async function findTmdbArtwork(
  kind: "movie" | "series",
  title: string,
  year: number | null,
) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({ api_key: apiKey, query: title });
  if (year) params.set(kind === "movie" ? "year" : "first_air_date_year", String(year));

  const type = kind === "movie" ? "movie" : "tv";
  const response = await fetch(
    `https://api.themoviedb.org/3/search/${type}?${params.toString()}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
  );

  if (!response.ok) return null;
  const result = ((await response.json()) as TmdbResponse).results?.[0];
  if (!result) return null;

  return {
    posterUrl: result.poster_path
      ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
      : null,
    backdropUrl: result.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`
      : null,
    overview: result.overview?.trim() || null,
  };
}
