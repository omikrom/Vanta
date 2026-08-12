import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { requireApiUser } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { getPrivateMedia } from "@/server/media/queries";
import { ensureHls, getTranscodeFile } from "@/server/playback";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; asset: string[] }> },
) {
  if (!(await requireApiUser())) return errorResponse("Unauthorized", 401);
  const { id, asset } = await params;
  const fileName = asset.length === 1 ? asset[0] : "";
  if (!/^(?:index\.m3u8|segment-\d{5}\.ts)$/.test(fileName)) {
    return errorResponse("Not found", 404);
  }
  const media = getPrivateMedia(id);
  if (!media) return errorResponse("Media not found", 404);

  try {
    const key = await ensureHls(id, media.file_path);
    const filePath = getTranscodeFile(key, fileName);
    if (!filePath) return errorResponse("Not found", 404);
    const stats = await fsp.stat(filePath).catch(() => null);
    if (!stats?.isFile()) return errorResponse("Segment is not ready", 404);
    const stream = fs.createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": fileName.endsWith(".m3u8")
          ? "application/vnd.apple.mpegurl"
          : "video/mp2t",
        "Content-Length": String(stats.size),
        "Cache-Control": fileName.endsWith(".m3u8")
          ? "private, no-store"
          : "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Could not prepare this stream",
      503,
    );
  }
}
