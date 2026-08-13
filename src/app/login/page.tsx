import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser, hasUsers } from "@/server/auth";
export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";
export default async function LoginPage() { if (await getSessionUser()) redirect("/browse"); if (!hasUsers()) redirect("/setup"); return <AuthForm mode="login" />; }
