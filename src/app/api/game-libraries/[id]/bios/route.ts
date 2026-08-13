import fs from "node:fs";
import { Readable } from "node:stream";
import { requireApiUser } from "@/server/auth";
import { resolvePrivateGameBios } from "@/server/games";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireApiUser())) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const asset = await resolvePrivateGameBios(id);
  if (!asset) return errorResponse("BIOS not found", 404);
  return new Response(Readable.toWeb(fs.createReadStream(asset.file.path)) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(asset.file.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
