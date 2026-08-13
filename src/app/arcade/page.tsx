import { ArcadeShell } from "@/components/arcade-shell";
import { requirePageUser } from "@/server/auth";
import { getArcadeFeed } from "@/server/games";

export const metadata = { title: "Arcade" };
export const dynamic = "force-dynamic";

export default async function ArcadePage() {
  const user = await requirePageUser();
  return <ArcadeShell user={user} feed={getArcadeFeed(user.id)} />;
}
