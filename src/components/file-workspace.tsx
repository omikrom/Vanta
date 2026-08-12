"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Archive, ChevronRight, Download, File, FileImage, FileSpreadsheet, FileText,
  Film, Folder, FolderLock, FolderOpen, HardDrive, Home, LoaderCircle,
  LockKeyhole, Music2, Pencil, Plus, RefreshCw, Search, ShieldCheck,
  Trash2, Upload, Users, X,
} from "lucide-react";
import { VantaMark } from "@/components/brand";
import { formatFileSize } from "@/lib/files";
import type { FileDirectoryView, FileEntry, FileRootSummary, SafeUser } from "@/lib/types";

function entryIcon(entry: FileEntry) {
  if (entry.kind === "folder") return <Folder />;
  if (entry.mimeType?.startsWith("image/")) return <FileImage />;
  if (entry.mimeType?.startsWith("video/")) return <Film />;
  if (entry.mimeType?.startsWith("audio/")) return <Music2 />;
  if (/spreadsheet|excel|csv/.test(entry.mimeType ?? "")) return <FileSpreadsheet />;
  if (/zip|rar|tar|gzip|7z/.test(entry.mimeType ?? "")) return <Archive />;
  if (entry.mimeType?.startsWith("text/") || /pdf|document|word/.test(entry.mimeType ?? "")) return <FileText />;
  return <File />;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(timestamp);
}

function storagePercent(root: FileRootSummary | undefined) {
  if (!root?.totalBytes || root.freeBytes == null) return null;
  return Math.max(0, Math.min(100, ((root.totalBytes - root.freeBytes) / root.totalBytes) * 100));
}

export function FileWorkspace({ user, initialRoots, initialDirectory }: {
  user: SafeUser;
  initialRoots: FileRootSummary[];
  initialDirectory: FileDirectoryView | null;
}) {
  const isOwner = user.role === "admin";
  const uploadInput = useRef<HTMLInputElement>(null);
  const [roots, setRoots] = useState(initialRoots);
  const [rootId, setRootId] = useState(initialDirectory?.root.id ?? initialRoots[0]?.id ?? "");
  const [directory, setDirectory] = useState(initialDirectory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [addingRoot, setAddingRoot] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const selectedRoot = roots.find((root) => root.id === rootId);
  const currentPath = directory?.relativePath ?? "";
  const canWrite = Boolean(isOwner && selectedRoot?.writable);
  const usage = storagePercent(selectedRoot);
  const entries = (directory?.entries ?? []).filter((entry) =>
    entry.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function loadDirectory(nextRootId: string, nextPath = "") {
    setLoading(true); setError(""); setNotice("");
    const response = await fetch(`/api/files?rootId=${encodeURIComponent(nextRootId)}&path=${encodeURIComponent(nextPath)}`);
    const payload = (await response.json().catch(() => ({}))) as { error?: string; directory?: FileDirectoryView };
    setLoading(false);
    if (!response.ok || !payload.directory) { setError(payload.error ?? "Could not open that folder"); return; }
    setRootId(nextRootId); setDirectory(payload.directory); setQuery("");
    setRoots((current) => current.map((root) => root.id === payload.directory?.root.id ? payload.directory.root : root));
  }

  async function refreshRoots(preferredId?: string) {
    const response = await fetch("/api/files/roots");
    const payload = (await response.json().catch(() => ({}))) as { roots?: FileRootSummary[] };
    const nextRoots = payload.roots ?? [];
    setRoots(nextRoots);
    const nextId = preferredId && nextRoots.some((root) => root.id === preferredId) ? preferredId : nextRoots[0]?.id;
    if (nextId) await loadDirectory(nextId);
    else { setRootId(""); setDirectory(null); }
  }

  async function connectRoot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/files/roots", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"), path: form.get("path"), access: form.get("access"),
        writable: form.get("writable") === "on",
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; id?: string };
    setLoading(false);
    if (!response.ok || !payload.id) { setError(payload.error ?? "Could not connect that storage location"); return; }
    setAddingRoot(false); await refreshRoots(payload.id); setNotice("Storage connected to Vanta");
  }

  async function disconnectRoot(root: FileRootSummary) {
    if (!window.confirm(`Disconnect “${root.name}” from Vanta? No files will be deleted.`)) return;
    setLoading(true);
    const response = await fetch(`/api/files/roots/${root.id}`, { method: "DELETE" });
    setLoading(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Could not disconnect that storage location"); return;
    }
    await refreshRoots(); setNotice(`${root.name} was disconnected; its files were left untouched`);
  }

  async function createNewFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); setError("");
    const response = await fetch("/api/files/folder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootId, parentPath: currentPath, name: form.get("name") }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);
    if (!response.ok) { setError(payload.error ?? "Could not create that folder"); return; }
    setAddingFolder(false); await loadDirectory(rootId, currentPath); setNotice("Folder created");
  }

  async function rename(entry: FileEntry) {
    const name = window.prompt("Rename this item", entry.name)?.trim();
    if (!name || name === entry.name) return;
    setLoading(true); setError("");
    const response = await fetch("/api/files/entry", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootId, path: entry.relativePath, newName: name }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);
    if (!response.ok) { setError(payload.error ?? "Could not rename that item"); return; }
    await loadDirectory(rootId, currentPath); setNotice(`Renamed to ${name}`);
  }

  async function trash(entry: FileEntry) {
    if (!window.confirm(`Move “${entry.name}” to Vanta's recovery folder?`)) return;
    setLoading(true); setError("");
    const response = await fetch("/api/files/entry", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootId, path: entry.relativePath }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);
    if (!response.ok) { setError(payload.error ?? "Could not move that item to trash"); return; }
    await loadDirectory(rootId, currentPath); setNotice(`${entry.name} is in Vanta's recovery folder`);
  }

  function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;
    const body = new FormData(); [...files].forEach((file) => body.append("files", file));
    setUploading(true); setUploadProgress(0); setError(""); setNotice("");
    const request = new XMLHttpRequest();
    request.open("POST", `/api/files/upload?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(currentPath)}`);
    request.upload.onprogress = (progress) => {
      if (progress.lengthComputable) setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
    };
    request.onload = () => {
      setUploading(false); event.target.value = "";
      let payload: { error?: string; uploaded?: string[] } = {};
      try { payload = JSON.parse(request.responseText) as typeof payload; } catch { /* handled below */ }
      if (request.status < 200 || request.status >= 300) { setError(payload.error ?? "The upload failed"); return; }
      void loadDirectory(rootId, currentPath).then(() => setNotice(`${payload.uploaded?.length ?? files.length} file${files.length === 1 ? "" : "s"} uploaded`));
    };
    request.onerror = () => { setUploading(false); event.target.value = ""; setError("The upload connection was interrupted"); };
    request.send(body);
  }

  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  return (
    <div className="file-shell">
      <header className="file-nav">
        <Link href="/browse"><VantaMark /></Link>
        <nav><Link href="/browse">Home</Link><Link href="/browse?view=movies">Movies</Link><Link href="/browse?view=series">Series</Link><Link href="/browse?view=music">Music</Link><span>Files</span></nav>
        <div><button aria-label="Refresh files" onClick={() => rootId && void loadDirectory(rootId, currentPath)} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /></button><span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span></div>
      </header>

      <main className="file-app">
        <aside className="file-sidebar">
          <div className="file-sidebar-heading"><span>STORAGE</span>{isOwner && <button onClick={() => { setError(""); setAddingRoot(true); }} aria-label="Connect storage"><Plus /></button>}</div>
          <div className="file-root-list">
            {roots.map((root) => (
              <div className={root.id === rootId ? "file-root active" : "file-root"} key={root.id}>
                <button onClick={() => void loadDirectory(root.id)}><span>{root.access === "shared" ? <Users /> : <FolderLock />}</span><span><strong>{root.name}</strong><small>{root.access === "shared" ? "Shared" : "Private"}{!root.writable ? " · Read-only" : ""}</small></span></button>
                {isOwner && root.id === rootId && <button className="root-remove" onClick={() => void disconnectRoot(root)} aria-label={`Disconnect ${root.name}`}><X /></button>}
              </div>
            ))}
          </div>
          <div className="file-sidebar-foot"><ShieldCheck /><p><strong>Private by default</strong><span>Only shared locations appear for viewers. Changes remain owner-only.</span></p></div>
        </aside>

        <section className="file-content">
          {!roots.length ? (
            <div className="file-empty-state"><span><HardDrive /></span><small>YOUR PRIVATE STORAGE</small><h1>Give Vanta somewhere to keep things.</h1><p>Connect an ordinary folder on this server. Vanta will make it browsable without moving or reorganising anything inside it.</p>{isOwner ? <button className="primary-button" onClick={() => setAddingRoot(true)}><Plus />Connect storage</button> : <p>Ask the Vanta owner to share a storage location with you.</p>}</div>
          ) : (
            <>
              <div className="file-content-head">
                <div><span className="eyebrow">VANTA FILES</span><h1>{selectedRoot?.name}</h1><div className="file-breadcrumbs"><button onClick={() => void loadDirectory(rootId)}><Home /></button>{breadcrumbs.map((part, index) => <span key={`${part}-${index}`}><ChevronRight /><button onClick={() => void loadDirectory(rootId, breadcrumbs.slice(0, index + 1).join("/"))}>{part}</button></span>)}</div></div>
                <div className="file-head-actions"><label className="file-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this folder" /></label>{canWrite && <><input ref={uploadInput} type="file" multiple hidden onChange={uploadFiles} /><button className="secondary-button" onClick={() => setAddingFolder(true)}><Plus />New folder</button><button className="primary-button" onClick={() => uploadInput.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" /> : <Upload />}{uploading ? `${uploadProgress}%` : "Upload"}</button></>}</div>
              </div>

              {selectedRoot && <div className="storage-strip"><div><HardDrive /><span><strong>{selectedRoot.freeBytes == null ? "Storage available" : `${formatFileSize(selectedRoot.freeBytes)} free`}</strong><small>{selectedRoot.totalBytes == null ? "Capacity unavailable" : `${formatFileSize(selectedRoot.totalBytes)} total`}</small></span></div>{usage != null && <span className="storage-meter"><i style={{ width: `${usage}%` }} /></span>}<span className={selectedRoot.access === "shared" ? "access-pill shared" : "access-pill"}>{selectedRoot.access === "shared" ? <Users /> : <LockKeyhole />}{selectedRoot.access}</span></div>}
              {error && <p className="admin-error file-message">{error}</p>}
              {notice && <p className="file-notice">{notice}</p>}
              {uploading && <div className="upload-progress"><span style={{ width: `${uploadProgress}%` }} /></div>}

              <div className="file-table-wrap">
                <table className="file-table">
                  <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>{entries.map((entry) => (
                    <tr key={entry.relativePath}>
                      <td><button className="file-name" onClick={() => entry.kind === "folder" && void loadDirectory(rootId, entry.relativePath)}>{entryIcon(entry)}<span><strong>{entry.name}</strong><small>{entry.kind === "folder" ? "Folder" : entry.mimeType}</small></span></button></td>
                      <td>{entry.kind === "folder" ? "Folder" : entry.name.split(".").at(-1)?.toUpperCase() ?? "File"}</td>
                      <td>{entry.kind === "folder" ? "—" : formatFileSize(entry.size)}</td><td>{formatDate(entry.modifiedAt)}</td>
                      <td><div className="file-row-actions">{entry.kind === "file" && <a href={`/api/files/download?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(entry.relativePath)}`} aria-label={`Download ${entry.name}`}><Download /></a>}{canWrite && <><button onClick={() => void rename(entry)} aria-label={`Rename ${entry.name}`}><Pencil /></button><button className="danger-icon" onClick={() => void trash(entry)} aria-label={`Move ${entry.name} to trash`}><Trash2 /></button></>}</div></td>
                    </tr>
                  ))}</tbody>
                </table>
                {!loading && !entries.length && <div className="folder-empty"><FolderOpen /><strong>{query ? "No matching items" : "This folder is empty"}</strong><p>{query ? "Try another name." : canWrite ? "Upload something or create a folder to get started." : "There is nothing here yet."}</p></div>}
                {loading && <div className="folder-loading"><LoaderCircle className="spin" />Opening folder…</div>}
              </div>
            </>
          )}
        </section>
      </main>

      {addingRoot && <div className="dialog-scrim" onMouseDown={(event) => event.target === event.currentTarget && !loading && setAddingRoot(false)}><form className="library-dialog file-dialog" onSubmit={connectRoot}><div className="dialog-heading"><div><span className="dialog-icon"><HardDrive /></span><div><h2>Connect storage</h2><p>Expose a server folder inside Vanta Files.</p></div></div><button type="button" onClick={() => setAddingRoot(false)}><X /></button></div><label><span>Location name</span><input name="name" placeholder="e.g. Family files" maxLength={80} required /></label><label><span>Folder path on the server</span><input name="path" placeholder="/storage or D:\Vanta\Files" maxLength={2048} required /><small>For Docker, mount a host folder and use its container path, such as /storage.</small></label><label><span>Who can see it?</span><select name="access" defaultValue="private"><option value="private">Owner only</option><option value="shared">All Vanta viewers</option></select></label><label className="rights-confirmation"><input name="writable" type="checkbox" defaultChecked /><span>Allow the owner to upload, rename and move items to recovery</span></label>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="text-button" onClick={() => setAddingRoot(false)}>Cancel</button><button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <Plus />}Connect folder</button></div></form></div>}
      {addingFolder && <div className="dialog-scrim" onMouseDown={(event) => event.target === event.currentTarget && !loading && setAddingFolder(false)}><form className="library-dialog file-dialog" onSubmit={createNewFolder}><div className="dialog-heading"><div><span className="dialog-icon"><Folder /></span><div><h2>New folder</h2><p>Create it inside {currentPath || selectedRoot?.name}.</p></div></div><button type="button" onClick={() => setAddingFolder(false)}><X /></button></div><label><span>Folder name</span><input name="name" placeholder="e.g. Photos" maxLength={255} autoFocus required /></label>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="text-button" onClick={() => setAddingFolder(false)}>Cancel</button><button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <Plus />}Create folder</button></div></form></div>}
    </div>
  );
}
