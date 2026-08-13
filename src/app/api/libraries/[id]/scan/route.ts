import { requireApiAdmin } from "@/server/auth";
import { errorResponse, isSameOrigin } from "@/server/http";
import { scanLibrary } from "@/server/media/scanner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  const { id } = await params;
  try {
    const result = await scanLibrary(id);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "The scan failed", 500);
  }
}
