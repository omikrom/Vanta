import { requireApiAdmin } from "@/server/auth";
import { errorResponse, isSameOrigin } from "@/server/http";
import { addLibrary, getLibraries } from "@/server/media/scanner";
import type { MediaKind } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  return Response.json({ libraries: getLibraries() });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    kind?: MediaKind;
    path?: string;
  } | null;
  if (!body?.name || !body.kind || !body.path) {
    return errorResponse("Name, type and folder are required");
  }

  try {
    const id = await addLibrary({ name: body.name, kind: body.kind, path: body.path });
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add the library";
    const friendly = message.includes("UNIQUE constraint")
      ? "That folder is already a Vanta library"
      : message;
    return errorResponse(friendly);
  }
}
