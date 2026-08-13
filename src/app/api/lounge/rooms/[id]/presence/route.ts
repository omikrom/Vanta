import { z } from "zod";
import { requireApiUser } from "@/server/auth";
import { LoungeError, updateWatchRoomPresence } from "@/server/lounge";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

const presenceSchema = z.object({
  state: z.enum(["joining", "ready", "playing", "paused", "buffering"]),
  position: z.number().finite().min(0).max(7 * 24 * 60 * 60),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const parsed = presenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid room presence");
  const { id } = await params;
  try {
    updateWatchRoomPresence(user, id, parsed.data.state, parsed.data.position);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not update room presence", error instanceof LoungeError ? error.status : 400);
  }
}
