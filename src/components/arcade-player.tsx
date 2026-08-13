"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Gamepad2, HardDriveDownload, ShieldCheck } from "lucide-react";
import type { PlayableGame, SafeUser } from "@/lib/types";

type EmulatorWindow = Window & Record<string, unknown>;

export function ArcadePlayer({ game, user }: { game: PlayableGame; user: SafeUser }) {
  const [status, setStatus] = useState("Preparing the cabinet…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void fetch(`/api/games/${game.id}/activity`, { method: "POST" });
    const runtime = window as unknown as EmulatorWindow;
    runtime.EJS_player = "#vanta-emulator";
    runtime.EJS_core = game.system;
    runtime.EJS_gameUrl = game.romUrl;
    runtime.EJS_biosUrl = game.biosUrl ?? "";
    runtime.EJS_gameName = game.title;
    runtime.EJS_gameID = game.storageId;
    runtime.EJS_pathtodata = "/emulatorjs/";
    runtime.EJS_color = "#a772ff";
    runtime.EJS_backgroundColor = "#08070b";
    runtime.EJS_startOnLoaded = false;
    runtime.EJS_startButtonName = "INSERT COIN";
    runtime.EJS_threads = game.system === "dos";
    runtime.EJS_DEBUG_XX = true;
    runtime.EJS_disableAutoLang = true;
    runtime.EJS_ready = () => setStatus("Ready — press Insert Coin");
    runtime.EJS_onGameStart = () => setStatus("Running");
    const loader = document.createElement("script");
    loader.src = "/emulatorjs/loader.js";
    loader.async = true;
    loader.onerror = () => { setFailed(true); setStatus("The emulator runtime could not be loaded"); };
    document.body.appendChild(loader);
    return () => { loader.remove(); };
  }, [game]);

  return (
    <main className="arcade-player-shell">
      <header className="player-nav"><a href="/arcade"><ArrowLeft />Back to Arcade</a><div><strong>{game.title}</strong><span>{game.systemLabel}</span></div><span className="player-status"><i />{status}</span></header>
      <section className="emulator-stage"><div id="vanta-emulator" />{failed && <div className="emulator-failure"><Gamepad2 /><h1>Cabinet offline</h1><p>Run <code>npm run prepare:emulator</code> and rebuild Vanta, then try again.</p></div>}</section>
      <footer className="player-foot"><span><Gamepad2 />Gamepad and keyboard controls can be remapped from the emulator menu.</span><span><HardDriveDownload />Saves are kept in this browser for {user.displayName}.</span><span><ShieldCheck />ROM and BIOS files remain behind Vanta authentication.</span></footer>
    </main>
  );
}
