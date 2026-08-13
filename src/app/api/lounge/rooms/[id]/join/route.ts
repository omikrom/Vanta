import { requireApiUser } from "@/server/auth";
import { joinWatchRoom, LoungeError } from "@/server/lounge";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  try {
    joinWatchRoom(user, id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not join the room", error instanceof LoungeError ? error.status : 400);
  }
}
