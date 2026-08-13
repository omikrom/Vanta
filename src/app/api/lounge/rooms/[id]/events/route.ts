import { requireApiUser } from "@/server/auth";
import { getWatchRoom } from "@/server/lounge";
import { subscribeWatchRoom } from "@/server/lounge-events";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  if (!getWatchRoom(user, id)) return errorResponse("Watch room not found", 404);

  const encoder = new TextEncoder();
  let close = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: string) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };
      const unsubscribe = subscribeWatchRoom(id, () => send("room", String(Date.now())));
      const heartbeat = setInterval(() => send("ping", String(Date.now())), 15_000);
      close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* connection already closed */ }
      };
      request.signal.addEventListener("abort", close, { once: true });
      send("room", String(Date.now()));
    },
    cancel() { close(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "private, no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
