import { z } from "zod";
import { requireApiUser } from "@/server/auth";
import { createWatchRoom, LoungeError } from "@/server/lounge";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

const createSchema = z.object({
  mediaId: z.string().uuid(),
  invitedUserIds: z.array(z.string().uuid()).max(50),
  controlMode: z.enum(["host", "everyone"]),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Check the room details");
  try {
    return Response.json({ ok: true, roomId: createWatchRoom(user, parsed.data) }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not create the watch room", error instanceof LoungeError ? error.status : 400);
  }
}
