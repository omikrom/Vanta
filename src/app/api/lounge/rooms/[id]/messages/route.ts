import { z } from "zod";
import { requireApiUser } from "@/server/auth";
import { addWatchRoomMessage, LoungeError } from "@/server/lounge";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

const messageSchema = z.object({
  kind: z.enum(["message", "reaction"]),
  body: z.string().max(500),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Check that message");
  const { id } = await params;
  try {
    return Response.json({ ok: true, id: addWatchRoomMessage(user, id, parsed.data.kind, parsed.data.body) }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not send that message", error instanceof LoungeError ? error.status : 400);
  }
}
