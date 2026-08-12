import { z } from "zod";
import { requireApiAdmin } from "@/server/auth";
import { createFolder } from "@/server/files";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

const folderSchema = z.object({
  rootId: z.string().uuid(),
  parentPath: z.string().max(4_096).default(""),
  name: z.string().min(1).max(255),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  const user = await requireApiAdmin();
  if (!user) return errorResponse("Forbidden", 403);
  const parsed = folderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid folder details");
  try {
    const relativePath = await createFolder(user, parsed.data.rootId, parsed.data.parentPath, parsed.data.name);
    return Response.json({ ok: true, relativePath }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create that folder";
    return errorResponse(message.includes("EEXIST") ? "An item with that name already exists" : message);
  }
}
