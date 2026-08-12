"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Film, FolderOpen, HardDrive, LoaderCircle, Music2, Plus, RefreshCw, Server, ShieldCheck, Trash2, Tv, UserPlus, UserRound } from "lucide-react";
import { VantaMark } from "@/components/brand";
import { YouTubeImporter } from "@/components/youtube-importer";
import type { Library, MediaKind, SafeUser } from "@/lib/types";

function kindIcon(kind: MediaKind) { if (kind === "music") return <Music2 />; if (kind === "series") return <Tv />; return <Film />; }

export function AdminPanel({ user, libraries, users }: { user: SafeUser; libraries: Library[]; users: SafeUser[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [addingViewer, setAddingViewer] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const totalItems = libraries.reduce((total, library) => total + library.itemCount, 0);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setWorkingId("new");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/libraries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), kind: data.get("kind"), path: data.get("path") }) });
    const result = (await response.json().catch(() => ({}))) as { error?: string; id?: string };
    if (!response.ok) { setError(result.error ?? "Could not add that library"); setWorkingId(null); return; }
    if (result.id) await scan(result.id, false);
    setAdding(false); setWorkingId(null); router.refresh();
  }

  async function scan(id: string, refresh = true) {
    setError(""); setWorkingId(id);
    const response = await fetch(`/api/libraries/${id}/scan`, { method: "POST" });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) setError(result.error ?? "The scan failed");
    setWorkingId(null); if (refresh) router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove “${name}” from Vanta? Your actual files will not be deleted.`)) return;
    setWorkingId(id); await fetch(`/api/libraries/${id}`, { method: "DELETE" }); setWorkingId(null); router.refresh();
  }

  async function addViewer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setWorkingId("viewer");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: data.get("displayName"), username: data.get("username"), password: data.get("password") }) });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) { setError(result.error ?? "Could not add that viewer"); setWorkingId(null); return; }
    setAddingViewer(false); setWorkingId(null); router.refresh();
  }

  async function removeViewer(viewer: SafeUser) {
    if (!window.confirm(`Remove ${viewer.displayName}'s access to Vanta?`)) return;
    setWorkingId(viewer.id); await fetch(`/api/users/${viewer.id}`, { method: "DELETE" }); setWorkingId(null); router.refresh();
  }

  return (
    <div className="admin-shell">
      <header className="admin-nav"><Link href="/browse"><VantaMark /></Link><Link className="back-link" href="/browse"><ArrowLeft size={17} />Back to Vanta</Link></header>
      <main className="admin-main">
        <div className="admin-heading"><div><span className="eyebrow">VANTA CONTROL ROOM</span><h1>Your server, at a glance.</h1><p>Connected as {user.displayName}. Libraries are read from the folders below; Vanta never moves the originals.</p></div><button className="primary-button" onClick={() => setAdding(true)}><Plus size={18} />Add library</button></div>
        <section className="stats-grid"><article><span><Server /></span><div><strong>{libraries.length}</strong><small>Connected libraries</small></div></article><article><span><Film /></span><div><strong>{totalItems}</strong><small>Indexed titles</small></div></article><article><span><ShieldCheck /></span><div><strong>{users.length}</strong><small>People with access</small></div></article><article className="future-stat"><span><HardDrive /></span><div><strong>Files</strong><small>NAS workspace · coming next</small></div></article></section>
        {error && <p className="admin-error">{error}</p>}
        <section className="admin-section">
          <div className="admin-section-heading"><div><h2>Media libraries</h2><p>Scan folders again whenever you add or rename files.</p></div></div>
          {!libraries.length ? <div className="admin-empty"><FolderOpen size={42} /><h3>No folders connected</h3><p>Add the folders where you keep your movies, series or music.</p><button className="secondary-button" onClick={() => setAdding(true)}><Plus size={18} />Connect a folder</button></div> : <div className="library-list">{libraries.map((library) => <article className="library-item" key={library.id}><span className={`library-icon icon-${library.kind}`}>{kindIcon(library.kind)}</span><div className="library-copy"><div><h3>{library.name}</h3><span>{library.kind}</span></div><code>{library.path}</code><p>{library.itemCount} items · {library.lastScannedAt ? `Scanned ${new Date(library.lastScannedAt).toLocaleString()}` : "Not scanned yet"}</p></div><div className="library-actions"><button onClick={() => void scan(library.id)} disabled={Boolean(workingId)} title="Scan now">{workingId === library.id ? <LoaderCircle className="spin" /> : <RefreshCw />}</button><button className="danger-icon" onClick={() => void remove(library.id, library.name)} disabled={Boolean(workingId)} title="Remove library"><Trash2 /></button></div></article>)}</div>}
        </section>
        <YouTubeImporter libraries={libraries} />
        <section className="admin-section">
          <div className="admin-section-heading split-heading"><div><h2>People with access</h2><p>Viewer accounts have access to every media library, but not the control room.</p></div><button className="secondary-button" onClick={() => setAddingViewer(true)}><UserPlus size={17} />Add viewer</button></div>
          <div className="people-list">{users.map((person) => <article key={person.id}><span className="person-avatar">{person.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{person.displayName}</strong><small>@{person.username} · {person.role === "admin" ? "Owner" : "Viewer"}</small></div>{person.role === "viewer" && <button onClick={() => void removeViewer(person)} disabled={Boolean(workingId)} title="Remove access"><Trash2 /></button>}</article>)}</div>
        </section>
        <section className="next-section"><div><span className="eyebrow">ON THE VANTA ROADMAP</span><h2>Your files, without the cloud.</h2><p>Uploads, downloads, shared folders and storage health will live here without changing the media experience you are building now.</p></div><div className="roadmap-pills"><span><CheckCircle2 />Secure users</span><span><CheckCircle2 />Media streaming</span><span><span className="roadmap-dot" />File workspace</span></div></section>
      </main>
      {adding && <div className="dialog-scrim" onMouseDown={(event) => event.target === event.currentTarget && setAdding(false)}><form className="library-dialog" onSubmit={add}><div className="dialog-heading"><div><span className="dialog-icon"><FolderOpen /></span><div><h2>Connect a library</h2><p>Vanta will read this folder and its subfolders.</p></div></div><button type="button" onClick={() => setAdding(false)}>×</button></div><label><span>Library name</span><input name="name" placeholder="e.g. Movies" required /></label><label><span>What lives here?</span><select name="kind" defaultValue="movie"><option value="movie">Movies</option><option value="series">TV series</option><option value="music">Music</option></select></label><label><span>Folder path on the server</span><input name="path" placeholder="/media/movies or D:\Media\Movies" required /><small>When using Docker, use the path inside the container, such as /media/movies.</small></label>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="text-button" onClick={() => setAdding(false)}>Cancel</button><button className="primary-button" disabled={Boolean(workingId)}>{workingId === "new" ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}Add and scan</button></div></form></div>}
      {addingViewer && <div className="dialog-scrim" onMouseDown={(event) => event.target === event.currentTarget && setAddingViewer(false)}><form className="library-dialog" onSubmit={addViewer}><div className="dialog-heading"><div><span className="dialog-icon"><UserRound /></span><div><h2>Add a viewer</h2><p>Give someone their own private sign-in.</p></div></div><button type="button" onClick={() => setAddingViewer(false)}>×</button></div><label><span>Display name</span><input name="displayName" placeholder="e.g. Karlie" maxLength={50} required /></label><label><span>Username</span><input name="username" placeholder="e.g. karlie" minLength={3} maxLength={32} pattern="[a-zA-Z0-9._-]+" required /></label><label><span>Temporary password</span><input name="password" type="password" placeholder="At least 10 characters" minLength={10} maxLength={128} required /><small>Send this securely. Password-changing and invitations come in a later account update.</small></label>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="text-button" onClick={() => setAddingViewer(false)}>Cancel</button><button className="primary-button" disabled={Boolean(workingId)}>{workingId === "viewer" ? <LoaderCircle className="spin" size={18} /> : <UserPlus size={18} />}Create viewer</button></div></form></div>}
    </div>
  );
}
