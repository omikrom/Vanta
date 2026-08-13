import { requireApiUser } from "@/server/auth";
import { listDirectory } from "@/server/files";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const search = new URL(request.url).searchParams;
  const rootId = search.get("rootId");
  if (!rootId) return errorResponse("Choose a storage location");
  try {
    return Response.json({ directory: await listDirectory(user, rootId, search.get("path") ?? "") });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not open that folder", 404);
  }
}
