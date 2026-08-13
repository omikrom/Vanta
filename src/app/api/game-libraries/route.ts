import { z } from "zod";
import { requireApiAdmin } from "@/server/auth";
import { addGameLibrary, getGameLibraries, supportedGameSystems } from "@/server/games";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

const librarySchema = z.object({
  name: z.string().trim().min(1).max(80),
  system: z.enum(supportedGameSystems.map((system) => system.id) as [string, ...string[]]),
  path: z.string().trim().min(1).max(2048),
  biosPath: z.string().trim().max(2048).optional().nullable(),
});

export async function GET() {
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  return Response.json({ libraries: getGameLibraries() });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  const parsed = librarySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Check the arcade library details");
  try {
    const id = await addGameLibrary(parsed.data);
    return Response.json({ ok: true, id });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not add that arcade library");
  }
}
