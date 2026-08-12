import { describe, expect, it } from "vitest";
import { parseYouTubeSearch, safePathPart } from "./youtube";

describe("safePathPart", () => {
  it("removes separators and Windows-invalid filename characters", () => {
    expect(safePathPart(' AC/DC: Live <2026> ', "Unknown")).toBe("AC DC Live 2026");
  });

  it("rejects traversal and reserved Windows device names", () => {
    expect(safePathPart("..", "Unknown")).toBe("Unknown");
    expect(safePathPart("CON", "Unknown")).toBe("Unknown");
  });
});

describe("parseYouTubeSearch", () => {
  it("returns safe, browser-facing search results", () => {
    expect(parseYouTubeSearch({
      entries: [{
        id: "dQw4w9WgXcQ",
        title: "Example song",
        channel: "Example Artist - Topic",
        duration: 213,
        thumbnails: [{ url: "http://unsafe.test/image.jpg" }, { url: "https://i.ytimg.com/example.jpg" }],
      }],
    })).toEqual([{
      id: "dQw4w9WgXcQ",
      title: "Example song",
      channel: "Example Artist - Topic",
      duration: 213,
      thumbnailUrl: "https://i.ytimg.com/example.jpg",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    }]);
  });

  it("drops malformed result IDs", () => {
    expect(parseYouTubeSearch({ entries: [{ id: "../../bad", title: "Bad" }] })).toEqual([]);
  });
});
