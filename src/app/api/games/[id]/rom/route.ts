import fs from "node:fs";
import { Readable } from "node:stream";
import { requireApiUser } from "@/server/auth";
import { resolvePrivateGameAsset } from "@/server/games";
import { errorResponse } from "@/server/http";
import { parseRange } from "@/server/playback";

export const runtime = "nodejs";

async function serve(request: Request, params: Promise<{ id: string }>, includeBody: boolean) {
  if (!(await requireApiUser())) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const asset = await resolvePrivateGameAsset(id, "rom");
  if (!asset) return errorResponse("ROM file is unavailable", 404);
  const { game, file } = asset;

  const requestedRange = request.headers.get("range");
  const range = parseRange(requestedRange, file.size);
  if (requestedRange && !range) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
  }
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(game.title)}.${game.extension.toLowerCase()}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (range) {
    const length = range.end - range.start + 1;
    headers.set("Content-Length", String(length));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${file.size}`);
    if (!includeBody) return new Response(null, { status: 206, headers });
    return new Response(Readable.toWeb(fs.createReadStream(file.path, range)) as ReadableStream, { status: 206, headers });
  }
  headers.set("Content-Length", String(file.size));
  if (!includeBody) return new Response(null, { headers });
  return new Response(Readable.toWeb(fs.createReadStream(file.path)) as ReadableStream, { headers });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return serve(request, params, true);
}

export async function HEAD(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return serve(request, params, false);
}
