import { z } from "zod";
import { requireApiAdmin, requireApiUser } from "@/server/auth";
import { addFileRoot, getFileRootSummaries } from "@/server/files";
import { errorResponse, isSameOrigin } from "@/server/http";

export const runtime = "nodejs";

const rootSchema = z.object({
  name: z.string().trim().min(1).max(80),
  path: z.string().trim().min(1).max(2_048),
  access: z.enum(["private", "shared"]),
  writable: z.boolean(),
});

export async function GET() {
  const user = await requireApiUser();
  if (!user) return errorResponse("Unauthorized", 401);
  return Response.json({ roots: await getFileRootSummaries(user) });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("Invalid request origin", 403);
  if (!(await requireApiAdmin())) return errorResponse("Forbidden", 403);
  const parsed = rootSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid storage details");
  try {
    const id = await addFileRoot(parsed.data);
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect that storage location";
    return errorResponse(message.includes("UNIQUE constraint") ? "That folder is already connected to Vanta" : message);
  }
}
