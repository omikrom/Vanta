import { createInitialAdmin } from "@/server/auth";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const body = await request.json().catch(() => null);
  const result = await createInitialAdmin(body);
  if (!result.ok) return errorResponse(result.error);
  return Response.json({ ok: true });
}
