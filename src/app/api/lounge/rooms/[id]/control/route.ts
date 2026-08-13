import { z } from "zod";
import { requireApiUser } from "@/server/auth";
import { controlWatchRoom, LoungeError } from "@/server/lounge";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

const controlSchema = z.object({
  action: z.enum(["start", "play", "pause", "seek", "end"]),
  position: z.number().finite().min(0).max(7 * 24 * 60 * 60),
  duration: z.number().finite().positive().max(7 * 24 * 60 * 60).nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const parsed = controlSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid playback command");
  const { id } = await params;
  try {
    controlWatchRoom(user, id, parsed.data);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not control playback", error instanceof LoungeError ? error.status : 400);
  }
}
