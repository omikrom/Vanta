import { requireApiAdmin } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { searchYouTube } from "@/server/youtube";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) {
    return errorResponse("Search for between 2 and 120 characters");
  }
  try {
    return Response.json({ results: await searchYouTube(query) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "YouTube search failed", 503);
  }
}
