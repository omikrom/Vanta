import { z } from "zod";
import { requireApiUser } from "@/server/auth";
import { errorResponse, isSameOrigin } from "@/server/http";
import { getPrivateMedia, updateProgress } from "@/server/media/queries";

export const runtime = "nodejs";

const progressSchema = z.object({
  position: z.number().finite().nonnegative(),
  duration: z.number().finite().positive().nullable().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  if (!getPrivateMedia(id)) return errorResponse("Media not found", 404);
  const parsed = progressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid playback progress");
  updateProgress(user.id, id, parsed.data.position, parsed.data.duration ?? null);
  return Response.json({ ok: true });
}
