import { describe, expect, it } from "vitest";
import { parseMediaName } from "./parser";

describe("parseMediaName", () => {
  it("cleans movie release names", () => {
    expect(parseMediaName("Dune.Part.Two.2024.2160p.UHD.BluRay.x265.mkv", "movie")).toMatchObject({
      title: "Dune Part Two",
      year: 2024,
      seriesTitle: null,
    });
  });

  it("extracts season and episode numbers", () => {
    expect(parseMediaName("The Expanse/The.Expanse.S03E06.Immolation.1080p.mkv", "series")).toMatchObject({
      title: "Immolation",
      seriesTitle: "The Expanse",
      season: 3,
      episode: 6,
    });
  });

  it("uses folders for artist and album metadata", () => {
    expect(parseMediaName("Massive Attack/Mezzanine/01 Angel.flac", "music")).toMatchObject({
      title: "Angel",
      artist: "Massive Attack",
      album: "Mezzanine",
      track: 1,
    });
  });
});
