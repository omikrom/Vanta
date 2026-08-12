import "server-only";

const attempts = new Map<string, { count: number; resetsAt: number }>();

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost ?? request.headers.get("host");
    return Boolean(host && originUrl.host === host);
  } catch {
    return false;
  }
}

export function getClientKey(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

export function consumeAuthAttempt(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetsAt <= now) {
    attempts.set(key, { count: 1, resetsAt: now + 10 * 60_000 });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  attempts.set(key, current);
  return {
    allowed: current.count <= 8,
    retryAfter: Math.max(1, Math.ceil((current.resetsAt - now) / 1000)),
  };
}

export function clearAuthAttempts(key: string) {
  attempts.delete(key);
}

export function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
