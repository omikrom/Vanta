import { createViewer, getUsers, requireApiAdmin } from "@/server/auth";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  return Response.json({ users: getUsers() });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  const result = await createViewer(await request.json().catch(() => null));
  if (!result.ok) return errorResponse(result.error);
  return Response.json({ ok: true }, { status: 201 });
}
