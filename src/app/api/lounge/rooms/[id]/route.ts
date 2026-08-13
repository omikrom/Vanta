import { requireApiUser } from "@/server/auth";
import { getWatchRoom } from "@/server/lounge";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const room = getWatchRoom(user, id);
  if (!room) return errorResponse("Watch room not found", 404);
  return Response.json({ room }, { headers: { "Cache-Control": "private, no-store" } });
}
