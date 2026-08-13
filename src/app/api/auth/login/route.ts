import { login } from "@/server/auth";
import {
  clearAuthAttempts,
  consumeAuthAttempt,
  errorResponse,
  getClientKey,
  isSameOrigin,
} from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const key = getClientKey(request);
  const limit = consumeAuthAttempt(key);
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const body = await request.json().catch(() => null);
  const result = await login(body);
  if (!result.ok) return errorResponse(result.error, 401);
  clearAuthAttempts(key);
  return Response.json({ ok: true, user: result.user });
}
