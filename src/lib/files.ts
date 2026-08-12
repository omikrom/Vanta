const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const INVALID_NAME_CHARACTER = /[<>:"/\\|?*\u0000-\u001f]/;

export const VANTA_TRASH_DIRECTORY = ".vanta-trash";

export function validateEntryName(value: unknown) {
  if (typeof value !== "string") throw new Error("Give this item a name");
  const name = value.trim();
  if (!name || name === "." || name === "..") throw new Error("Give this item a name");
  if (name.length > 255) throw new Error("Use a name shorter than 256 characters");
  if (INVALID_NAME_CHARACTER.test(name)) {
    throw new Error("Names cannot contain < > : \" / \\ | ? * or control characters");
  }
  if (/[. ]$/.test(name)) throw new Error("Names cannot end with a dot or space");
  if (WINDOWS_RESERVED_NAME.test(name)) throw new Error("That name is reserved by the operating system");
  if (name.toLowerCase() === VANTA_TRASH_DIRECTORY) throw new Error("That name is reserved by Vanta");
  return name;
}

export function splitRelativePath(value: unknown) {
  if (value == null || value === "") return [];
  if (typeof value !== "string" || value.length > 4_096) throw new Error("Invalid folder path");
  if (value.includes("\\") || value.includes("\0")) throw new Error("Invalid folder path");
  const segments = value.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Invalid folder path");
  }
  if (segments.some((segment) => segment.toLowerCase() === VANTA_TRASH_DIRECTORY)) {
    throw new Error("That folder is managed by Vanta");
  }
  return segments.map(validateEntryName);
}

export function joinRelativePath(...parts: Array<string | null | undefined>) {
  return parts
    .flatMap((part) => splitRelativePath(part ?? ""))
    .join("/");
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 || value >= 10 ? 0 : 1)} ${units[exponent]}`;
}
