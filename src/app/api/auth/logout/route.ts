import { logout } from "@/server/auth";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  await logout();
  return Response.json({ ok: true });
}
