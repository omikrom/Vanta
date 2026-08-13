import { describe, expect, it } from "vitest";
import { acceptsGameExtension, cleanGameTitle, gameSystem, stableGameStorageId } from "./games";

describe("game library helpers", () => {
  it("maps supported systems to the installed EmulatorJS cores", () => {
    expect(gameSystem("nes")?.core).toBe("fceumm");
    expect(gameSystem("psx")?.core).toBe("pcsx_rearmed");
    expect(gameSystem("not-a-console")).toBeNull();
  });

  it("accepts extensions only for the configured system", () => {
    expect(acceptsGameExtension("nes", ".NES")).toBe(true);
    expect(acceptsGameExtension("arcade", ".zip")).toBe(true);
    expect(acceptsGameExtension("arcade", ".gba")).toBe(false);
  });

  it("turns common ROM release names into display titles", () => {
    expect(cleanGameTitle("Super_Mario_World_(USA)_[!].sfc")).toBe("Super Mario World");
    expect(cleanGameTitle("Sonic.The.Hedgehog (Europe).md")).toBe("Sonic The Hedgehog");
  });

  it("isolates browser save storage by both user and game", () => {
    const first = stableGameStorageId("user-a", "game-a");
    expect(first).toBe(stableGameStorageId("user-a", "game-a"));
    expect(first).not.toBe(stableGameStorageId("user-b", "game-a"));
    expect(first).not.toBe(stableGameStorageId("user-a", "game-b"));
  });
});
