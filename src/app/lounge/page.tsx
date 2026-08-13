import { LoungeShell } from "@/components/lounge-shell";
import { requirePageUser } from "@/server/auth";
import { getLoungeFeed } from "@/server/lounge";

export const metadata = { title: "Vanta Lounge" };
export const dynamic = "force-dynamic";

export default async function LoungePage({ searchParams }: PageProps<"/lounge">) {
  const user = await requirePageUser();
  const initialMediaId = String((await searchParams).mediaId ?? "");
  return <LoungeShell user={user} feed={getLoungeFeed(user)} initialMediaId={initialMediaId} />;
}
