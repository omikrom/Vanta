"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Download, Gamepad2, LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { GAME_SYSTEMS, gameSystem } from "@/lib/games";
import type { GameLibrary } from "@/lib/types";

export function ArcadeAdmin({ libraries }: { libraries: GameLibrary[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const totalGames = libraries.reduce((total, library) => total + library.itemCount, 0);

  async function scan(id: string, refresh = true) {
    setWorking(id); setError("");
    const response = await fetch(`/api/game-libraries/${id}/scan`, { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setWorking(null);
    if (!response.ok) { setError(payload.error ?? "The arcade scan failed"); return; }
    if (refresh) router.refresh();
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking("new"); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/game-libraries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), system: form.get("system"), path: form.get("path"), biosPath: form.get("biosPath") || null }) });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; id?: string };
    if (!response.ok || !payload.id) { setWorking(null); setError(payload.error ?? "Could not connect that ROM folder"); return; }
    await scan(payload.id, false); setAdding(false); setWorking(null); router.refresh();
  }

  async function remove(library: GameLibrary) {
    if (!window.confirm(`Remove “${library.name}” from Vanta Arcade? No ROMs will be deleted.`)) return;
    setWorking(library.id);
    const response = await fetch(`/api/game-libraries/${library.id}`, { method: "DELETE" });
    setWorking(null);
    if (!response.ok) { setError("Could not remove that arcade library"); return; }
    router.refresh();
  }

  async function installDemo() {
    setWorking("demo"); setError("");
    const response = await fetch("/api/game-libraries/demo", { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setWorking(null);
    if (!response.ok) { setError(payload.error ?? "Could not install the free demo"); return; }
    router.refresh();
  }

  return (
    <section className="admin-section arcade-admin">
      <div className="admin-section-heading split-heading"><div><h2>Arcade libraries</h2><p>{totalGames} playable games across {libraries.length} connected ROM folders.</p></div><div className="arcade-admin-actions"><button className="secondary-button" onClick={() => void installDemo()} disabled={Boolean(working)}>{working === "demo" ? <LoaderCircle className="spin" /> : <Download />}Install free NES demo</button><button className="primary-button" onClick={() => setAdding(true)}><Plus />Add ROM folder</button></div></div>
      <div className="legal-rom-note"><ShieldCheck /><span><strong>Your dumps, your server.</strong> Vanta installs emulator cores, not commercial games. Add ROMs and BIOS files you have the right to use.</span></div>
      {error && <p className="admin-error">{error}</p>}
      {!libraries.length ? <div className="admin-empty arcade-admin-empty"><Gamepad2 /><h3>No cabinets installed</h3><p>Use the legal demo to test Arcade instantly, or connect your own ROM collection.</p></div> : <div className="library-list">{libraries.map((library) => <article className="library-item" key={library.id}><span className="library-icon icon-game"><Gamepad2 /></span><div className="library-copy"><div><h3>{library.name}</h3><span>{gameSystem(library.system)?.shortLabel}</span></div><code>{library.path}</code><p>{library.itemCount} games · {library.biosPath ? "BIOS connected · " : ""}{library.lastScannedAt ? `Scanned ${new Date(library.lastScannedAt).toLocaleString()}` : "Not scanned yet"}</p></div><div className="library-actions"><button onClick={() => void scan(library.id)} disabled={Boolean(working)} title="Scan now">{working === library.id ? <LoaderCircle className="spin" /> : <RefreshCw />}</button><button className="danger-icon" onClick={() => void remove(library)} disabled={Boolean(working)} title="Remove library"><Trash2 /></button></div></article>)}</div>}
      {adding && <div className="dialog-scrim" onMouseDown={(event) => event.target === event.currentTarget && !working && setAdding(false)}><form className="library-dialog arcade-library-dialog" onSubmit={add}><div className="dialog-heading"><div><span className="dialog-icon"><Gamepad2 /></span><div><h2>Connect a ROM folder</h2><p>Choose one system so Vanta knows which emulator core to launch.</p></div></div><button type="button" onClick={() => setAdding(false)}><X /></button></div><label><span>Library name</span><input name="name" placeholder="e.g. Mega Drive Classics" maxLength={80} required /></label><label><span>System</span><select name="system" defaultValue="nes">{GAME_SYSTEMS.map((system) => <option key={system.id} value={system.id}>{system.label}</option>)}</select></label><label><span>ROM folder on the server</span><input name="path" placeholder="/games/nes or D:\Games\NES" maxLength={2048} required /><small>Use a separate folder per system. ZIP archives are supported where the emulator core supports them.</small></label><label><span>BIOS file path <small>(optional)</small></span><input name="biosPath" placeholder="/games/bios/scph5501.bin" maxLength={2048} /><small>Some disc-based systems need a BIOS dumped from your own hardware.</small></label>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="text-button" onClick={() => setAdding(false)}>Cancel</button><button className="primary-button" disabled={Boolean(working)}>{working === "new" ? <LoaderCircle className="spin" /> : <Plus />}Connect and scan</button></div></form></div>}
    </section>
  );
}
