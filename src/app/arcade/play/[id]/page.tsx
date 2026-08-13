import { notFound } from "next/navigation";
import { ArcadePlayer } from "@/components/arcade-player";
import { requirePageUser } from "@/server/auth";
import { getPlayableGame } from "@/server/games";

export const metadata = { title: "Vanta Arcade" };
export const dynamic = "force-dynamic";

export default async function ArcadePlayerPage({ params }: PageProps<"/arcade/play/[id]">) {
  const user = await requirePageUser();
  const { id } = await params;
  const game = getPlayableGame(user.id, id);
  if (!game) notFound();
  return <ArcadePlayer game={game} user={user} />;
}
