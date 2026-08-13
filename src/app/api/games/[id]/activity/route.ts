import { z } from "zod";
import { requireApiUser } from "@/server/auth";
import { recordGameLaunch, setGameFavorite } from "@/server/games";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  try {
    recordGameLaunch(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not record this game", 404);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const parsed = z.object({ favorite: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Choose whether this game is a favorite");
  const { id } = await params;
  try {
    setGameFavorite(user.id, id, parsed.data.favorite);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not update this game", 404);
  }
}
