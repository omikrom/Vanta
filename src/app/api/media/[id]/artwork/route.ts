import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import mime from "mime-types";
import { requireApiUser } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { getPrivateMedia } from "@/server/media/queries";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireApiUser())) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const media = getPrivateMedia(id);
  if (!media) return errorResponse("Media not found", 404);
  const kind = new URL(request.url).searchParams.get("kind");
  const artworkPath = kind === "backdrop" ? media.backdrop_path : media.poster_path;
  if (!artworkPath) return errorResponse("Artwork not found", 404);
  const stats = await fsp.stat(artworkPath).catch(() => null);
  if (!stats?.isFile()) return errorResponse("Artwork not found", 404);

  const stream = fs.createReadStream(artworkPath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": mime.lookup(artworkPath) || "image/jpeg",
      "Content-Length": String(stats.size),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
