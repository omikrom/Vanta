import { FileWorkspace } from "@/components/file-workspace";
import { requirePageUser } from "@/server/auth";
import { getFileRootSummaries, listDirectory } from "@/server/files";

export const metadata = { title: "Files" };
export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const user = await requirePageUser();
  const roots = await getFileRootSummaries(user);
  const initialDirectory = roots[0]
    ? await listDirectory(user, roots[0].id).catch(() => null)
    : null;
  return <FileWorkspace user={user} initialRoots={roots} initialDirectory={initialDirectory} />;
}
