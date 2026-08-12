import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { requireApiUser } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { getPrivateMedia } from "@/server/media/queries";
import { parseRange } from "@/server/playback";

export const runtime = "nodejs";

async function serve(
  request: Request,
  params: Promise<{ id: string }>,
  includeBody: boolean,
) {
  if (!(await requireApiUser())) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const media = getPrivateMedia(id);
  if (!media) return errorResponse("Media not found", 404);

  const stats = await fsp.stat(media.file_path).catch(() => null);
  if (!stats?.isFile()) return errorResponse("Media file is unavailable", 404);

  const requestedRange = request.headers.get("range");
  const range = parseRange(requestedRange, stats.size);
  if (requestedRange && !range) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${stats.size}` },
    });
  }

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": media.mime_type,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });

  if (range) {
    const length = range.end - range.start + 1;
    headers.set("Content-Length", String(length));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${stats.size}`);
    if (!includeBody) return new Response(null, { status: 206, headers });
    const stream = fs.createReadStream(media.file_path, range);
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
  }

  headers.set("Content-Length", String(stats.size));
  if (!includeBody) return new Response(null, { headers });
  const stream = fs.createReadStream(media.file_path);
  return new Response(Readable.toWeb(stream) as ReadableStream, { headers });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return serve(request, context.params, true);
}

export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) {
  return serve(request, context.params, false);
}
