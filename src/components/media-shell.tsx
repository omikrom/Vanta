"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronRight, Clock3, Film, FolderOpen, Gamepad2, Home, Info, LibraryBig, LogOut, Menu, Music2, Play, Search, Settings, Sparkles, Tv, X } from "lucide-react";
import { VantaMark } from "@/components/brand";
import { PlayerOverlay } from "@/components/player-overlay";
import type { HomeFeed, MediaItem, SafeUser } from "@/lib/types";

type View = "home" | "movies" | "series" | "music";
const displayTitle = (item: MediaItem) => item.seriesTitle ?? item.title;

function subtitle(item: MediaItem) {
  if (item.kind === "series") return `S${String(item.season ?? 0).padStart(2, "0")} E${String(item.episode ?? 0).padStart(2, "0")} · ${item.title}`;
  if (item.kind === "music") return [item.artist, item.album].filter(Boolean).join(" · ");
  return item.year ? String(item.year) : "Movie";
}

function progressPercent(item: MediaItem) {
  return item.progressDuration && item.progress ? Math.min(100, (item.progress / item.progressDuration) * 100) : 0;
}

function MediaCard({ item, onOpen }: { item: MediaItem; onOpen: (item: MediaItem) => void }) {
  const title = displayTitle(item);
  return (
    <button className="media-card" onClick={() => onOpen(item)} aria-label={`Open ${title}`}>
      <span className={`media-poster poster-${item.kind}`} style={item.posterUrl ? { backgroundImage: `url("${item.posterUrl}")` } : undefined}>
        {!item.posterUrl && <span className="poster-fallback">{item.kind === "music" ? <Music2 /> : item.kind === "series" ? <Tv /> : <Film />}<strong>{title}</strong></span>}
        <span className="card-play"><Play fill="currentColor" size={21} /></span>
        {item.progress > 0 && !item.completed && <span className="card-progress"><i style={{ width: `${progressPercent(item)}%` }} /></span>}
        {item.completed && <span className="watched-badge"><Check size={13} /></span>}
      </span>
      <span className="card-copy"><strong>{title}</strong><small>{subtitle(item)}</small></span>
    </button>
  );
}

function MediaRow({ title, icon, items, onOpen }: { title: string; icon?: ReactNode; items: MediaItem[]; onOpen: (item: MediaItem) => void }) {
  if (!items.length) return null;
  return (
    <section className="media-section">
      <div className="section-heading"><h2>{icon}{title}</h2><span>{items.length} {items.length === 1 ? "title" : "titles"}<ChevronRight size={16} /></span></div>
      <div className="media-row">{items.map((item) => <MediaCard key={item.id} item={item} onOpen={onOpen} />)}</div>
    </section>
  );
}

function DetailPanel({ item, onClose, onPlay }: { item: MediaItem; onClose: () => void; onPlay: () => void }) {
  return (
    <div className="detail-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="detail-panel" role="dialog" aria-modal="true">
        <button className="detail-close" onClick={onClose} aria-label="Close"><X /></button>
        <div className="detail-art" style={item.backdropUrl || item.posterUrl ? { backgroundImage: `url("${item.backdropUrl ?? item.posterUrl}")` } : undefined}>
          <div className="detail-art-shade" />
          <div className="detail-title"><span className="eyebrow">{item.kind === "series" ? "VANTA SERIES" : item.kind === "music" ? "VANTA MUSIC" : "NOW IN YOUR LIBRARY"}</span><h2>{displayTitle(item)}</h2></div>
        </div>
        <div className="detail-body">
          <div className="detail-actions"><button className="primary-button" onClick={onPlay}><Play size={18} fill="currentColor" />{item.progress > 5 ? "Resume" : "Play"}</button><span className="format-pill">{item.playbackMode === "hls" ? "AUTO CONVERT" : "DIRECT PLAY"}</span></div>
          <div className="detail-grid">
            <p className="detail-overview">{item.overview ?? (item.kind === "series" ? `${subtitle(item)}. Ready to stream from your Vanta server.` : item.kind === "music" ? `From ${item.album ?? "your music library"}${item.artist ? ` by ${item.artist}` : ""}.` : "Ready to stream from your private Vanta library.")}</p>
            <dl><div><dt>Added</dt><dd>{new Date(item.addedAt).toLocaleDateString()}</dd></div><div><dt>Format</dt><dd>{item.mimeType.split("/").at(-1)?.toUpperCase()}</dd></div><div><dt>Size</dt><dd>{(item.fileSize / 1024 ** 3).toFixed(item.fileSize > 1024 ** 3 ? 1 : 2)} GB</dd></div></dl>
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyLibrary({ isAdmin }: { isAdmin: boolean }) {
  return (
    <section className="empty-library">
      <div className="empty-orbit"><span /><span /><span /><LibraryBig /></div>
      <span className="eyebrow">THE SHELVES ARE READY</span><h1>Bring your collection home.</h1>
      <p>Connect a movie, series or music folder. Vanta will organise it and make it available on every device you allow.</p>
      {isAdmin ? <Link className="primary-button" href="/admin"><FolderOpen size={18} />Add your first library</Link> : <p className="muted">Ask the Vanta owner to connect a media library.</p>}
    </section>
  );
}

export function MediaShell({ user, feed, initialView }: { user: SafeUser; feed: HomeFeed; initialView: View }) {
  const router = useRouter();
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [playing, setPlaying] = useState<MediaItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const all = useMemo(() => [...new Map([...feed.movies, ...feed.series, ...feed.music].map((item) => [item.id, item])).values()], [feed]);
  const searchResults = query.trim() ? all.filter((item) => [item.title, item.seriesTitle, item.artist, item.album].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase())) : [];
  const featured = feed.featured;

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  function play(item: MediaItem) { setSelected(null); setPlaying(item); }
  const views: { id: View; label: string; icon: ReactNode }[] = [
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "movies", label: "Movies", icon: <Film size={18} /> },
    { id: "series", label: "Series", icon: <Tv size={18} /> },
    { id: "music", label: "Music", icon: <Music2 size={18} /> },
  ];

  return (
    <div className="app-shell">
      <header className="top-nav">
        <Link href="/browse" className="brand-link"><VantaMark /></Link>
        <nav className={mobileMenu ? "nav-links nav-links-open" : "nav-links"}>
          {views.map((view) => <Link key={view.id} href={view.id === "home" ? "/browse" : `/browse?view=${view.id}`} className={initialView === view.id ? "active" : ""} onClick={() => setMobileMenu(false)}>{view.icon}{view.label}</Link>)}
          <Link href="/files"><FolderOpen size={18} />Files</Link>
          <Link href="/arcade"><Gamepad2 size={18} />Arcade</Link>
        </nav>
        <div className="nav-actions">
          <button onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={20} /></button>
          {user.role === "admin" && <Link href="/admin" aria-label="Server settings"><Settings size={20} /></Link>}
          <div className="user-menu"><button className="avatar" title={user.displayName}>{user.displayName.slice(0, 1).toUpperCase()}</button><div className="user-popover"><strong>{user.displayName}</strong><span>{user.role === "admin" ? "Vanta owner" : "Viewer"}</span><button onClick={() => void logout()}><LogOut size={16} />Sign out</button></div></div>
          <button className="mobile-menu-button" onClick={() => setMobileMenu((open) => !open)} aria-label="Open menu">{mobileMenu ? <X /> : <Menu />}</button>
        </div>
      </header>

      {!all.length ? <EmptyLibrary isAdmin={user.role === "admin"} /> : (
        <main>
          {initialView === "home" && featured && (
            <section className="hero" style={featured.backdropUrl || featured.posterUrl ? { backgroundImage: `url("${featured.backdropUrl ?? featured.posterUrl}")` } : undefined}>
              <div className="hero-shade" />
              <div className="hero-content"><span className="eyebrow"><Sparkles size={14} /> {featured.progress > 5 ? "CONTINUE WATCHING" : "FEATURED FROM YOUR LIBRARY"}</span><h1>{displayTitle(featured)}</h1><div className="hero-meta">{featured.year && <span>{featured.year}</span>}{featured.kind === "series" && <span>Season {featured.season}</span>}<span>{featured.playbackMode === "direct" ? "Direct play" : "Ready to convert"}</span></div><p>{featured.overview ?? subtitle(featured)}</p><div className="hero-actions"><button className="primary-button" onClick={() => play(featured)}><Play size={19} fill="currentColor" />{featured.progress > 5 ? "Resume" : "Play now"}</button><button className="secondary-button" onClick={() => setSelected(featured)}><Info size={19} />More info</button></div></div>
              {featured.progress > 5 && <div className="hero-progress"><Clock3 size={14} /><span><i style={{ width: `${progressPercent(featured)}%` }} /></span></div>}
            </section>
          )}
          <div className={initialView === "home" ? "content-rows content-overlap" : "content-rows content-page"}>
            {initialView === "home" && <><MediaRow title="Continue watching" icon={<Clock3 size={19} />} items={feed.continueWatching} onOpen={setSelected} /><MediaRow title="Recently added" icon={<Sparkles size={19} />} items={feed.recentlyAdded} onOpen={setSelected} /><MediaRow title="Movies" items={feed.movies.slice(0, 20)} onOpen={setSelected} /><MediaRow title="Series" items={feed.series.slice(0, 20)} onOpen={setSelected} /><MediaRow title="From your speakers" items={feed.music.slice(0, 20)} onOpen={setSelected} /></>}
            {initialView === "movies" && <MediaRow title="Your movies" icon={<Film size={20} />} items={feed.movies} onOpen={setSelected} />}
            {initialView === "series" && <MediaRow title="Your series" icon={<Tv size={20} />} items={feed.series} onOpen={setSelected} />}
            {initialView === "music" && <MediaRow title="Your music" icon={<Music2 size={20} />} items={feed.music} onOpen={setSelected} />}
          </div>
        </main>
      )}

      <nav className="bottom-nav">{views.map((view) => <Link key={view.id} className={initialView === view.id ? "active" : ""} href={view.id === "home" ? "/browse" : `/browse?view=${view.id}`}>{view.icon}<span>{view.label}</span></Link>)}<Link href="/files"><FolderOpen size={18} /><span>Files</span></Link><Link href="/arcade"><Gamepad2 size={18} /><span>Arcade</span></Link></nav>
      {selected && <DetailPanel item={selected} onClose={() => setSelected(null)} onPlay={() => play(selected)} />}
      {playing && <PlayerOverlay item={playing} onClose={() => { setPlaying(null); router.refresh(); }} />}
      {searchOpen && <div className="search-overlay"><div className="search-bar"><Search size={24} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Movies, series, songs, artists…" /><button onClick={() => { setSearchOpen(false); setQuery(""); }} aria-label="Close search"><X /></button></div><div className="search-content">{!query && <div className="search-prompt"><Search size={44} /><h2>Search your world</h2><p>Everything on this Vanta server, in one place.</p></div>}{query && !searchResults.length && <div className="search-prompt"><h2>No matches</h2><p>Try another title, artist or album.</p></div>}{searchResults.length > 0 && <div className="search-grid">{searchResults.map((item) => <MediaCard key={item.id} item={item} onOpen={(match) => { setSearchOpen(false); setSelected(match); setQuery(""); }} />)}</div>}</div></div>}
    </div>
  );
}
