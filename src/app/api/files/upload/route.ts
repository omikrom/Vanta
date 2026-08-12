import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import busboy from "busboy";
import { validateEntryName } from "@/lib/files";
import { requireApiAdmin } from "@/server/auth";
import { MAX_UPLOAD_BYTES } from "@/server/config";
import { writableDirectory } from "@/server/files";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 900;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiAdmin();
  if (!user) return errorResponse("Forbidden", 403);
  if (!request.body) return errorResponse("No files were received");
  const search = new URL(request.url).searchParams;
  const rootId = search.get("rootId");
  if (!rootId) return errorResponse("Choose a storage location");

  let directory;
  try {
    directory = await writableDirectory(user, rootId, search.get("path") ?? "");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not open that folder");
  }

  const writtenPaths: string[] = [];
  const writes: Promise<void>[] = [];
  let uploadError: Error | null = null;
  let fileCount = 0;

  try {
    const parser = busboy({
      headers: Object.fromEntries(request.headers.entries()),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 20, fields: 0, parts: 20, headerPairs: 100 },
    });
    parser.on("file", (_field, stream, info) => {
      fileCount += 1;
      let name: string;
      try {
        name = validateEntryName(path.basename(info.filename));
      } catch (error) {
        uploadError ??= error instanceof Error ? error : new Error("Invalid file name");
        stream.resume();
        return;
      }
      const target = path.join(directory.realPath, name);
      const output = createWriteStream(target, { flags: "wx", mode: 0o640 });
      let opened = false;
      output.once("open", () => { opened = true; });
      const write = pipeline(stream, output)
        .then(async () => {
          if (stream.truncated) {
            await fs.rm(target, { force: true });
            throw new Error(`${name} is larger than Vanta's upload limit`);
          }
          writtenPaths.push(target);
        })
        .catch(async (error: unknown) => {
          // `wx` protects existing files. Only remove the target when this request
          // actually created it; otherwise an EEXIST failure would delete the
          // user's original file during cleanup.
          if (opened) await fs.rm(target, { force: true }).catch(() => null);
          const message = error instanceof Error && "code" in error && error.code === "EEXIST"
            ? `${name} already exists in this folder`
            : error instanceof Error ? error.message : `Could not save ${name}`;
          uploadError ??= new Error(message);
        });
      writes.push(write);
    });
    parser.once("filesLimit", () => { uploadError ??= new Error("Upload no more than 20 files at once"); });
    parser.once("partsLimit", () => { uploadError ??= new Error("Upload no more than 20 files at once"); });
    await pipeline(
      Readable.fromWeb(request.body as import("node:stream/web").ReadableStream),
      parser,
    );
    await Promise.all(writes);
    if (!fileCount) uploadError ??= new Error("Choose at least one file to upload");
    if (uploadError) throw uploadError;
    return Response.json({ ok: true, uploaded: writtenPaths.map((filePath) => path.basename(filePath)) });
  } catch (error) {
    await Promise.allSettled(writes);
    await Promise.all(writtenPaths.map((filePath) => fs.rm(filePath, { force: true }).catch(() => null)));
    return errorResponse(error instanceof Error ? error.message : "The upload failed");
  }
}
