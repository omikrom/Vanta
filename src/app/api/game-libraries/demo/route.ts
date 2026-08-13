import { requireApiAdmin } from "@/server/auth";
import { installDemoGameLibrary } from "@/server/games";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  try {
    return Response.json({ ok: true, ...(await installDemoGameLibrary()) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not install the demo game");
  }
}
