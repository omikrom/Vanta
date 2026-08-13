import { AdminPanel } from "@/components/admin-panel";
import { getUsers, requirePageAdmin } from "@/server/auth";
import { getGameLibraries } from "@/server/games";
import { getLibraries } from "@/server/media/scanner";
export const metadata = { title: "Control room" };
export const dynamic = "force-dynamic";
export default async function AdminPage() { const user = await requirePageAdmin(); return <AdminPanel user={user} libraries={getLibraries()} gameLibraries={getGameLibraries()} users={getUsers()} />; }
