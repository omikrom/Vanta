"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  LibraryBig,
  LoaderCircle,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Library, YouTubeSearchResult } from "@/lib/types";

function YouTubeGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.64 4.6 12 4.6 12 4.6s-5.64 0-7.5.5a3 3 0 0 0-2.1 2.1A31 31 0 0 0 2 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.86.5 7.5.5 7.5.5s5.64 0 7.5-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.8Z" fill="currentColor" />
      <path d="m10 15.2 5-3.2-5-3.2v6.4Z" fill="#151319" />
    </svg>
  );
}

function formatDuration(duration: number | null) {
  if (!duration) return "Duration unavailable";
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function suggestedArtist(channel: string) {
  return channel.replace(/\s+-\s+Topic$/i, "").trim() || channel;
}

export function YouTubeImporter({ libraries }: { libraries: Library[] }) {
  const router = useRouter();
  const musicLibraries = libraries.filter((library) => library.kind === "music");
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [selected, setSelected] = useState<YouTubeSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = String(data.get("query") ?? "").trim();
    if (query.length < 2) return;
    setSearching(true);
    setError("");
    setSuccess("");
    const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      results?: YouTubeSearchResult[];
    };
    setSearching(false);
    if (!response.ok) {
      setResults([]);
      setError(payload.error ?? "YouTube search failed");
      return;
    }
    setResults(payload.results ?? []);
    if (!payload.results?.length) setError("No videos matched that search");
  }

  async function importTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    setImporting(true);
    setError("");
    setSuccess("");
    const response = await fetch("/api/youtube/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: selected.id,
        libraryId: data.get("libraryId"),
        artist: data.get("artist"),
        album: data.get("album"),
        title: data.get("title"),
        rightsConfirmed: data.get("rightsConfirmed") === "on",
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      imported?: { title: string; artist: string; album: string };
    };
    setImporting(false);
    if (!response.ok) {
      setError(payload.error ?? "The import failed");
      return;
    }
    const imported = payload.imported;
    setSuccess(imported
      ? `Added “${imported.title}” to ${imported.artist} · ${imported.album}`
      : "Track imported into Vanta");
    setSelected(null);
    router.refresh();
  }

  return (
    <section className="admin-section youtube-section">
      <div className="admin-section-heading split-heading">
        <div>
          <span className="youtube-kicker"><YouTubeGlyph size={15} /> YOUTUBE IMPORT</span>
          <h2>Find it. File it. Play it.</h2>
          <p>Search YouTube, extract authorised audio and place it directly under an artist in Vanta Music.</p>
        </div>
        <span className="owner-only"><ShieldCheck size={14} />Owner only</span>
      </div>

      <div className="youtube-tool">
        <div className="youtube-legal">
          <ShieldCheck size={18} />
          <p>Import only content you own, have permission to use, or that is licensed for downloading. YouTube&apos;s own terms and the creator&apos;s rights still apply.</p>
        </div>

        {!musicLibraries.length ? (
          <div className="youtube-empty">
            <LibraryBig size={35} />
            <div><strong>Connect a music library first</strong><p>YouTube imports need a writable music folder so Vanta knows where to save them.</p></div>
          </div>
        ) : (
          <>
            <form className="youtube-search" onSubmit={search}>
              <Search size={20} />
              <input name="query" minLength={2} maxLength={120} placeholder="Search for an artist, song or live performance…" required />
              <button className="primary-button" disabled={searching}>{searching ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}{searching ? "Searching" : "Search"}</button>
            </form>

            {error && !selected && <p className="admin-error youtube-message">{error}</p>}
            {success && <p className="youtube-success"><CheckCircle2 size={17} />{success}</p>}

            {results.length > 0 && (
              <div className="youtube-results">
                {results.map((result) => (
                  <article key={result.id}>
                    <span
                      className="youtube-thumbnail"
                      style={result.thumbnailUrl ? { backgroundImage: `url("${result.thumbnailUrl}")` } : undefined}
                    >
                      {!result.thumbnailUrl && <YouTubeGlyph size={32} />}
                      <small>{formatDuration(result.duration)}</small>
                    </span>
                    <div className="youtube-result-copy">
                      <strong>{result.title}</strong>
                      <span>{result.channel}</span>
                      <div>
                        <button onClick={() => { setError(""); setSelected(result); }}><Download size={15} />Import audio</button>
                        <a href={result.url} target="_blank" rel="noreferrer"><ExternalLink size={14} />View</a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <div className="dialog-scrim" onMouseDown={(event) => event.target === event.currentTarget && !importing && setSelected(null)}>
          <form className="library-dialog youtube-import-dialog" onSubmit={importTrack}>
            <div className="dialog-heading">
              <div><span className="dialog-icon youtube-dialog-icon"><YouTubeGlyph /></span><div><h2>Import into Vanta Music</h2><p>Choose how this track appears in your gallery.</p></div></div>
              <button type="button" disabled={importing} onClick={() => setSelected(null)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="selected-video">
              <span style={selected.thumbnailUrl ? { backgroundImage: `url("${selected.thumbnailUrl}")` } : undefined}>{!selected.thumbnailUrl && <YouTubeGlyph />}</span>
              <div><strong>{selected.title}</strong><small>{selected.channel} · {formatDuration(selected.duration)}</small></div>
            </div>
            <label><span>Music library</span><select name="libraryId" defaultValue={musicLibraries[0]?.id} required>{musicLibraries.map((library) => <option key={library.id} value={library.id}>{library.name} — {library.path}</option>)}</select></label>
            <div className="form-columns">
              <label><span>Artist</span><input name="artist" defaultValue={suggestedArtist(selected.channel)} maxLength={100} required /></label>
              <label><span>Album</span><input name="album" defaultValue="YouTube Imports" maxLength={100} required /></label>
            </div>
            <label><span>Track title</span><input name="title" defaultValue={selected.title} maxLength={150} required /><small>Saved as Artist / Album / Track title.mp3, with its thumbnail kept as cover art.</small></label>
            <label className="rights-confirmation"><input name="rightsConfirmed" type="checkbox" required /><span>I own this content, have permission, or it is licensed for downloading.</span></label>
            {error && <p className="form-error">{error}</p>}
            <div className="dialog-actions"><button type="button" className="text-button" disabled={importing} onClick={() => setSelected(null)}>Cancel</button><button className="primary-button" disabled={importing}>{importing ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}{importing ? "Downloading and filing…" : "Import track"}</button></div>
            {importing && <p className="import-wait">Vanta is extracting the best available audio, embedding metadata and rescanning your music. Keep this window open.</p>}
          </form>
        </div>
      )}
    </section>
  );
}
