import { requireApiAdmin } from "@/server/auth";
import { scanGameLibrary } from "@/server/games";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  const { id } = await params;
  try {
    return Response.json({ ok: true, ...(await scanGameLibrary(id)) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "The arcade scan failed");
  }
}
