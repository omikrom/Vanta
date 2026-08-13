import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser, hasUsers } from "@/server/auth";
export const metadata = { title: "Set up" };
export const dynamic = "force-dynamic";
export default async function SetupPage() { if (await getSessionUser()) redirect("/browse"); if (hasUsers()) redirect("/login"); return <AuthForm mode="setup" />; }
