import fs from "node:fs";
import { Readable } from "node:stream";
import mime from "mime-types";
import { requireApiUser } from "@/server/auth";
import { resolvePrivateGameAsset } from "@/server/games";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireApiUser())) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const kind = new URL(request.url).searchParams.get("kind");
  const asset = await resolvePrivateGameAsset(id, kind === "background" ? "background" : "cover");
  if (!asset) return errorResponse("Artwork not found", 404);
  return new Response(Readable.toWeb(fs.createReadStream(asset.file.path)) as ReadableStream, {
    headers: {
      "Content-Type": mime.lookup(asset.file.path) || "image/jpeg",
      "Content-Length": String(asset.file.size),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
