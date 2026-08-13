import { z } from "zod";
import { requireApiUser } from "@/server/auth";
import { LoungeError, setWatchRoomReady } from "@/server/lounge";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const parsed = z.object({ ready: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Choose your ready state");
  const { id } = await params;
  try {
    setWatchRoomReady(user, id, parsed.data.ready);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not update ready state", error instanceof LoungeError ? error.status : 400);
  }
}
