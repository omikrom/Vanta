import { notFound } from "next/navigation";
import { WatchRoomPlayer } from "@/components/watch-room-player";
import { requirePageUser } from "@/server/auth";
import { getWatchRoom } from "@/server/lounge";

export const metadata = { title: "Watch Together · Vanta" };
export const dynamic = "force-dynamic";

export default async function WatchRoomPage({ params }: PageProps<"/lounge/room/[id]">) {
  const user = await requirePageUser();
  const { id } = await params;
  const room = getWatchRoom(user, id);
  if (!room) notFound();
  return <WatchRoomPlayer user={user} initialRoom={room} />;
}
