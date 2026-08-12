import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { requireApiUser } from "@/server/auth";
import { downloadableFile } from "@/server/files";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";

function contentDisposition(name: string) {
  const fallback = name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/["\\]/g, "_") || "download";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const search = new URL(request.url).searchParams;
  const rootId = search.get("rootId");
  const requestedPath = search.get("path");
  if (!rootId || !requestedPath) return errorResponse("Choose a file to download");
  try {
    const file = await downloadableFile(user, rootId, requestedPath);
    const stream = Readable.toWeb(createReadStream(file.path)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.size),
        "Content-Disposition": contentDisposition(file.name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not download that file", 404);
  }
}
