import { describe, expect, it } from "vitest";
import { cleanRoomMessage, isRoomReaction, roomPlaybackPosition } from "./lounge";

describe("Watch Together synchronization", () => {
  it("advances playing rooms from the shared server timestamp", () => {
    expect(roomPlaybackPosition({ status: "playing", position: 50, stateUpdatedAt: 1_000, playAt: null, now: 4_500, duration: 100 })).toBe(53.5);
    expect(roomPlaybackPosition({ status: "playing", position: 50, stateUpdatedAt: 1_000, playAt: 5_000, now: 4_500, duration: 100 })).toBe(50);
  });

  it("does not advance paused rooms and caps known durations", () => {
    expect(roomPlaybackPosition({ status: "paused", position: 44, stateUpdatedAt: 1_000, playAt: null, now: 9_000, duration: null })).toBe(44);
    expect(roomPlaybackPosition({ status: "playing", position: 98, stateUpdatedAt: 1_000, playAt: null, now: 9_000, duration: 100 })).toBe(100);
  });

  it("cleans chat and restricts quick reactions", () => {
    expect(cleanRoomMessage("  Meet you at the sofa!\u0000 ")).toBe("Meet you at the sofa!");
    expect(() => cleanRoomMessage(" ")).toThrow("Write a message");
    expect(isRoomReaction("🍿")).toBe(true);
    expect(isRoomReaction("🔥")).toBe(false);
  });
});
