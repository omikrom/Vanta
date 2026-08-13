"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  Clapperboard, Film, FolderOpen, Gamepad2, Home, LockKeyhole, LogOut,
  Menu, MessageCircle, Music2, Play, Plus, Radio, Settings, Tv, Users, X,
} from "lucide-react";
import { VantaMark } from "@/components/brand";
import type { LoungeFeed, MediaItem, SafeUser, WatchRoomSummary } from "@/lib/types";

const mediaTitle = (item: MediaItem) => item.seriesTitle ?? item.title;

function roomState(room: WatchRoomSummary) {
  if (room.status === "waiting") return room.joined ? "Waiting in the lobby" : "You are invited";
  if (room.status === "playing") return "Watching now";
  if (room.status === "paused") return "Paused together";
  return "Room ended";
}

function RoomCard({ room }: { room: WatchRoomSummary }) {
  return (
    <Link className="lounge-room-card" href={`/lounge/room/${room.id}`}>
      <span className="lounge-room-art" style={room.media.backdropUrl || room.media.posterUrl ? { backgroundImage: `url("${room.media.backdropUrl ?? room.media.posterUrl}")` } : undefined}>
        <span className="lounge-room-shade" />
        <span className={`room-live-state state-${room.status}`}><i />{roomState(room)}</span>
        <span className="room-play"><Play fill="currentColor" /></span>
      </span>
      <span className="lounge-room-copy">
        <small>{room.hostDisplayName}&apos;s room</small>
        <strong>{mediaTitle(room.media)}</strong>
        <span><Users />{room.memberCount} joined · {room.invitedCount} invited</span>
      </span>
    </Link>
  );
}

export function LoungeShell({ user, feed, initialMediaId = "" }: { user: SafeUser; feed: LoungeFeed; initialMediaId?: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(Boolean(initialMediaId && feed.watchableMedia.some((item) => item.id === initialMediaId)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mediaQuery, setMediaQuery] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const invitees = feed.people.filter((person) => person.id !== user.id);
  const visibleMedia = useMemo(() => feed.watchableMedia.filter((item) =>
    [item.title, item.seriesTitle].filter(Boolean).join(" ").toLowerCase().includes(mediaQuery.trim().toLowerCase()),
  ), [feed.watchableMedia, mediaQuery]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/lounge/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId: form.get("mediaId"),
        invitedUserIds: form.getAll("invitedUserIds"),
        controlMode: form.get("controlMode"),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; roomId?: string };
    setLoading(false);
    if (!response.ok || !payload.roomId) { setError(payload.error ?? "Could not create the room"); return; }
    router.push(`/lounge/room/${payload.roomId}`);
  }

  return (
    <div className="lounge-shell">
      <header className="top-nav lounge-nav">
        <Link href="/browse" className="brand-link"><VantaMark /></Link>
        <nav className={mobileMenu ? "nav-links nav-links-open" : "nav-links"}>
          <Link href="/browse"><Home />Home</Link><Link href="/browse?view=movies"><Film />Movies</Link><Link href="/browse?view=series"><Tv />Series</Link><Link href="/browse?view=music"><Music2 />Music</Link><Link href="/files"><FolderOpen />Files</Link><Link href="/arcade"><Gamepad2 />Arcade</Link><Link href="/lounge" className="active"><Users />Lounge</Link>
        </nav>
        <div className="nav-actions">
          {user.role === "admin" && <Link href="/admin" aria-label="Server settings"><Settings /></Link>}
          <div className="user-menu"><button className="avatar" title={user.displayName}>{user.displayName.slice(0, 1).toUpperCase()}</button><div className="user-popover"><strong>{user.displayName}</strong><span>In your private circle</span><button onClick={() => void logout()}><LogOut />Sign out</button></div></div>
          <button className="mobile-menu-button" onClick={() => setMobileMenu((open) => !open)} aria-label="Open menu">{mobileMenu ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main className="lounge-main">
        <section className="lounge-hero">
          <div className="lounge-orbits"><i /><i /><i /></div>
          <div className="lounge-hero-copy"><span className="eyebrow"><Radio /> VANTA LOUNGE</span><h1>Your people.<br />One screen.</h1><p>Watch together, react in the moment and keep the conversation inside your private Vanta server.</p><button className="primary-button" onClick={() => { setError(""); setCreating(true); }} disabled={!feed.watchableMedia.length}><Plus />Start a watch room</button></div>
          <div className="lounge-hero-people">{feed.people.slice(0, 6).map((person, index) => <span key={person.id} style={{ "--person-index": index } as CSSProperties} className={person.online ? "online" : ""}><b>{person.displayName.slice(0, 1).toUpperCase()}</b><i /> </span>)}</div>
        </section>

        <div className="lounge-content">
          <section className="lounge-section">
            <div className="lounge-heading"><div><span className="eyebrow">WATCH TOGETHER</span><h2>Rooms in your circle</h2></div><button className="secondary-button" onClick={() => { setError(""); setCreating(true); }} disabled={!feed.watchableMedia.length}><Plus />New room</button></div>
            {feed.rooms.length ? <div className="lounge-room-grid">{feed.rooms.map((room) => <RoomCard room={room} key={room.id} />)}</div> : <div className="lounge-empty"><Clapperboard /><h3>The lounge is quiet.</h3><p>Start a private room, invite your Vanta people and everyone will be kept on the same frame.</p></div>}
          </section>

          <section className="lounge-section circle-section">
            <div className="lounge-heading"><div><span className="eyebrow">YOUR CIRCLE</span><h2>{feed.people.length} Vanta {feed.people.length === 1 ? "profile" : "profiles"}</h2></div><span className="privacy-chip"><LockKeyhole />Only this server</span></div>
            <div className="circle-grid">{feed.people.map((person) => <article key={person.id}><span className="circle-avatar">{person.displayName.slice(0, 1).toUpperCase()}<i className={person.online ? "online" : ""} /></span><div><strong>{person.displayName}{person.id === user.id ? " (you)" : ""}</strong><small>@{person.username}</small></div><span className={person.online ? "person-state online" : "person-state"}>{person.online ? "In the Lounge" : "Offline"}</span></article>)}</div>
          </section>

          <section className="lounge-coming"><MessageCircle /><div><span className="eyebrow">COMING INTO FOCUS</span><h2>Recommendations, shared lists and movie-night polls.</h2><p>Watch Together is the live foundation. The Lounge can grow into Vanta&apos;s private social feed without exposing anyone to the public internet.</p></div></section>
        </div>
      </main>

      <nav className="bottom-nav lounge-bottom-nav"><Link href="/browse"><Home /><span>Home</span></Link><Link href="/browse?view=movies"><Film /><span>Movies</span></Link><Link href="/browse?view=series"><Tv /><span>Series</span></Link><Link href="/browse?view=music"><Music2 /><span>Music</span></Link><Link href="/files"><FolderOpen /><span>Files</span></Link><Link href="/arcade"><Gamepad2 /><span>Arcade</span></Link><Link className="active" href="/lounge"><Users /><span>Lounge</span></Link></nav>

      {creating && <div className="dialog-scrim" onMouseDown={(event) => event.target === event.currentTarget && !loading && setCreating(false)}><form className="library-dialog lounge-dialog" onSubmit={createRoom}>
        <div className="dialog-heading"><div><span className="dialog-icon"><Clapperboard /></span><div><h2>Start Watch Together</h2><p>Choose something and invite your Vanta circle.</p></div></div><button type="button" onClick={() => setCreating(false)}><X /></button></div>
        <label><span>Find a film or episode</span><input value={mediaQuery} onChange={(event) => setMediaQuery(event.target.value)} placeholder="Search your library" /></label>
        <label><span>Watch</span><select name="mediaId" required defaultValue={initialMediaId}><option value="" disabled>Choose a title</option>{visibleMedia.map((item) => <option value={item.id} key={item.id}>{item.kind === "series" ? `${item.seriesTitle} — ${item.title}` : item.title}</option>)}</select></label>
        <fieldset className="invite-fieldset"><legend>Invite people</legend>{invitees.length ? <div className="invite-list">{invitees.map((person) => <label key={person.id}><input type="checkbox" name="invitedUserIds" value={person.id} defaultChecked /><span className="circle-avatar small">{person.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{person.displayName}</strong><small>@{person.username}</small></span></label>)}</div> : <p>Create viewer accounts in the control room to invite other people. You can still test a room yourself.</p>}</fieldset>
        <label><span>Playback controls</span><select name="controlMode" defaultValue="host"><option value="host">Host controls playback</option><option value="everyone">Everyone can control</option></select><small>You can still see when another person is buffering.</small></label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions"><button type="button" className="text-button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-button" disabled={loading}>{loading ? "Opening room…" : "Create room"}</button></div>
      </form></div>}
    </div>
  );
}
