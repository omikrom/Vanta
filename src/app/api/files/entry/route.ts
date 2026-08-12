import { z } from "zod";
import { requireApiAdmin } from "@/server/auth";
import { moveEntryToTrash, renameEntry } from "@/server/files";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

const entrySchema = z.object({
  rootId: z.string().uuid(),
  path: z.string().min(1).max(4_096),
  newName: z.string().min(1).max(255),
});

const trashSchema = entrySchema.pick({ rootId: true, path: true });

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiAdmin();
  if (!user) return errorResponse("Forbidden", 403);
  const parsed = entrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid file details");
  try {
    return Response.json({ ok: true, relativePath: await renameEntry(user, parsed.data.rootId, parsed.data.path, parsed.data.newName) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not rename that item");
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiAdmin();
  if (!user) return errorResponse("Forbidden", 403);
  const parsed = trashSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid file details");
  try {
    return Response.json({ ok: true, name: await moveEntryToTrash(user, parsed.data.rootId, parsed.data.path) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not move that item to trash");
  }
}
