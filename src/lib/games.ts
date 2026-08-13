export const GAME_SYSTEMS = [
  { id: "nes", label: "Nintendo Entertainment System", shortLabel: "NES", core: "fceumm", extensions: [".nes", ".zip"] },
  { id: "snes", label: "Super Nintendo", shortLabel: "SNES", core: "snes9x", extensions: [".sfc", ".smc", ".zip"] },
  { id: "gb", label: "Game Boy / Game Boy Color", shortLabel: "GB / GBC", core: "gambatte", extensions: [".gb", ".gbc", ".zip"] },
  { id: "gba", label: "Game Boy Advance", shortLabel: "GBA", core: "mgba", extensions: [".gba", ".zip"] },
  { id: "n64", label: "Nintendo 64", shortLabel: "N64", core: "mupen64plus_next", extensions: [".z64", ".n64", ".v64", ".zip"] },
  { id: "nds", label: "Nintendo DS", shortLabel: "NDS", core: "melonds", extensions: [".nds", ".zip"] },
  { id: "segaMS", label: "Sega Master System", shortLabel: "MASTER SYSTEM", core: "smsplus", extensions: [".sms", ".zip"] },
  { id: "segaMD", label: "Sega Mega Drive / Genesis", shortLabel: "MEGA DRIVE", core: "genesis_plus_gx", extensions: [".md", ".gen", ".smd", ".zip"] },
  { id: "segaGG", label: "Sega Game Gear", shortLabel: "GAME GEAR", core: "genesis_plus_gx", extensions: [".gg", ".zip"] },
  { id: "sega32x", label: "Sega 32X", shortLabel: "32X", core: "picodrive", extensions: [".32x", ".zip"] },
  { id: "segaCD", label: "Sega CD / Mega-CD", shortLabel: "SEGA CD", core: "genesis_plus_gx", extensions: [".chd", ".iso", ".zip"] },
  { id: "psx", label: "Sony PlayStation", shortLabel: "PS1", core: "pcsx_rearmed", extensions: [".chd", ".pbp", ".iso", ".zip"] },
  { id: "atari2600", label: "Atari 2600", shortLabel: "ATARI 2600", core: "stella2014", extensions: [".a26", ".bin", ".zip"] },
  { id: "a5200", label: "Atari 5200", shortLabel: "ATARI 5200", core: "a5200", extensions: [".a52", ".bin", ".zip"] },
  { id: "atari7800", label: "Atari 7800", shortLabel: "ATARI 7800", core: "prosystem", extensions: [".a78", ".bin", ".zip"] },
  { id: "lynx", label: "Atari Lynx", shortLabel: "LYNX", core: "handy", extensions: [".lnx", ".zip"] },
  { id: "coleco", label: "ColecoVision", shortLabel: "COLECOVISION", core: "gearcoleco", extensions: [".col", ".rom", ".zip"] },
  { id: "c64", label: "Commodore 64", shortLabel: "C64", core: "vice_x64sc", extensions: [".d64", ".t64", ".crt", ".prg", ".zip"] },
  { id: "amiga", label: "Commodore Amiga", shortLabel: "AMIGA", core: "puae", extensions: [".adf", ".hdf", ".lha", ".zip"] },
  { id: "arcade", label: "Arcade (FinalBurn Neo)", shortLabel: "ARCADE", core: "fbneo", extensions: [".zip"] },
  { id: "mame2003", label: "Arcade (MAME 2003)", shortLabel: "MAME 2003", core: "mame2003", extensions: [".zip"] },
  { id: "3do", label: "3DO", shortLabel: "3DO", core: "opera", extensions: [".chd", ".iso", ".zip"] },
  { id: "dos", label: "DOS", shortLabel: "DOS", core: "dosbox_pure", extensions: [".zip"] },
] as const;

export type GameSystem = (typeof GAME_SYSTEMS)[number]["id"];

export function gameSystem(value: string) {
  return GAME_SYSTEMS.find((system) => system.id === value) ?? null;
}

export function acceptsGameExtension(system: GameSystem, extension: string) {
  return gameSystem(system)?.extensions.includes(extension.toLowerCase() as never) ?? false;
}

export function cleanGameTitle(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return withoutExtension
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\((?:USA|Europe|Japan|World|En(?:,[A-Za-z]+)*|Rev[^)]*|v\d[^)]*|Proto[^)]*|Beta[^)]*)\)/gi, " ")
    .replace(/[._]+/g, " ")
    .replace(/\s+-\s+/g, " — ")
    .replace(/\s+/g, " ")
    .trim() || "Untitled game";
}

export function stableGameStorageId(userId: string, gameId: string) {
  const input = `${userId}:${gameId}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}
