"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { VantaMark } from "@/components/brand";

export function AuthForm({ mode }: { mode: "setup" | "login" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSetup = mode === "setup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
    }).catch(() => null);

    if (!response) {
      setError("Vanta could not reach the server");
      setPending(false);
      return;
    }
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Something went wrong");
      setPending(false);
      return;
    }
    router.push("/browse");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-aurora auth-aurora-one" />
      <div className="auth-aurora auth-aurora-two" />
      <section className="auth-panel">
        <VantaMark />
        <div className="auth-copy">
          <span className="eyebrow">{isSetup ? "YOUR SERVER. YOUR WORLD." : "WELCOME BACK"}</span>
          <h1>{isSetup ? "Make yourself at home." : "Everything you love, waiting."}</h1>
          <p>{isSetup ? "Create the owner account for this Vanta server. You can invite everyone else later." : "Sign in to your private cinema, record shelf and file space."}</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Username</span>
            <span className="input-shell"><UserRound size={18} /><input name="username" autoComplete="username" minLength={3} maxLength={32} placeholder="Your username" autoFocus required /></span>
          </label>
          <label>
            <span>Password</span>
            <span className="input-shell">
              <LockKeyhole size={18} />
              <input name="password" type={showPassword ? "text" : "password"} autoComplete={isSetup ? "new-password" : "current-password"} minLength={10} maxLength={128} placeholder={isSetup ? "At least 10 characters" : "Your password"} required />
              <button className="input-icon-button" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </span>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button auth-submit" disabled={pending}>
            {pending ? <LoaderCircle className="spin" size={19} /> : null}{isSetup ? "Create Vanta" : "Enter Vanta"}{!pending ? <ArrowRight size={19} /> : null}
          </button>
        </form>
        <p className="auth-footnote">Private by design <span /> Stored on your hardware <span /> No subscription</p>
      </section>
    </main>
  );
}
