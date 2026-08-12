import { redirect } from "next/navigation";
import { getSessionUser, hasUsers } from "@/server/auth";
export const dynamic = "force-dynamic";
export default async function LandingPage() { const user = await getSessionUser(); redirect(user ? "/browse" : hasUsers() ? "/login" : "/setup"); }
