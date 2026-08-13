import { z } from "zod";
import { requireApiAdmin } from "@/server/auth";
import { errorResponse, isSameOrigin } from "@/server/http";
import { importYouTubeAudio } from "@/server/youtube";

export const runtime = "nodejs";
export const maxDuration = 900;

const importSchema = z.object({
  videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
  libraryId: z.string().min(1).max(100),
  artist: z.string().trim().min(1).max(100),
  album: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(150),
  rightsConfirmed: z.literal(true),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("Complete the track details and confirm you have permission to download it");
  }
  try {
    const imported = await importYouTubeAudio(parsed.data);
    return Response.json({ ok: true, imported });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "The import failed", 500);
  }
}
