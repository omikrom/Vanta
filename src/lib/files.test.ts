import { describe, expect, it } from "vitest";
import { formatFileSize, joinRelativePath, splitRelativePath, validateEntryName } from "./files";

describe("file workspace paths", () => {
  it("accepts normal cross-platform file and folder names", () => {
    expect(validateEntryName("Family photos 2026")).toBe("Family photos 2026");
    expect(validateEntryName("budget.xlsx")).toBe("budget.xlsx");
    expect(splitRelativePath("Documents/Invoices/2026")).toEqual(["Documents", "Invoices", "2026"]);
    expect(joinRelativePath("Documents/Invoices", "August")).toBe("Documents/Invoices/August");
  });

  it("blocks traversal, separators and operating-system reserved names", () => {
    expect(() => splitRelativePath("Documents/../Secrets")).toThrow("Invalid folder path");
    expect(() => splitRelativePath("Documents\\Secrets")).toThrow("Invalid folder path");
    expect(() => validateEntryName("CON.txt")).toThrow("reserved");
    expect(() => validateEntryName("bad/name")).toThrow("cannot contain");
  });

  it("keeps Vanta's recovery directory private", () => {
    expect(() => splitRelativePath(".vanta-trash/file.txt")).toThrow("managed by Vanta");
    expect(() => validateEntryName(".vanta-trash")).toThrow("reserved by Vanta");
  });

  it("formats storage sizes for the workspace", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(5 * 1024 ** 3)).toBe("5.0 GB");
  });
});
