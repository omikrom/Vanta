import { requireApiAdmin } from "@/server/auth";
import { removeGameLibrary } from "@/server/games";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  const { id } = await params;
  removeGameLibrary(id);
  return Response.json({ ok: true });
}
