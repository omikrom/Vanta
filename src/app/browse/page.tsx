import { MediaShell } from "@/components/media-shell";
import { requirePageUser } from "@/server/auth";
import { getHomeFeed } from "@/server/media/queries";
export const metadata = { title: "Browse" };
export const dynamic = "force-dynamic";
type View = "home" | "movies" | "series" | "music";
export default async function BrowsePage({ searchParams }: PageProps<"/browse">) { const user = await requirePageUser(); const requestedView = (await searchParams).view; const initialView: View = ["movies", "series", "music"].includes(String(requestedView)) ? (requestedView as View) : "home"; return <MediaShell user={user} feed={getHomeFeed(user.id)} initialView={initialView} />; }
