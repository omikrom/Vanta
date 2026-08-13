"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft, Check, CircleStop, Clock3, Copy, Crown, LoaderCircle,
  MessageCircle, Play, Radio, Send, ShieldCheck, Users,
} from "lucide-react";
import type HlsType from "hls.js";
import { ROOM_REACTIONS } from "@/lib/lounge";
import type { SafeUser, WatchPresenceState, WatchRoomSnapshot } from "@/lib/types";

type ControlAction = "start" | "play" | "pause" | "seek" | "end";

function title(room: WatchRoomSnapshot) { return room.media.seriesTitle ?? room.media.title; }

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function WatchRoomPlayer({ user, initialRoom }: { user: SafeUser; initialRoom: WatchRoomSnapshot }) {
  const [room, setRoom] = useState(initialRoom);
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [copied, setCopied] = useState(false);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const remoteUntil = useRef(0);
  const presenceState = useRef<WatchPresenceState>(room.ready ? "ready" : "joining");
  const lastSaved = useRef(0);
  const messagesEnd = useRef<HTMLDivElement | null>(null);
  const canControl = room.isHost || room.controlMode === "everyone";
  const everyoneReady = room.members.length > 0 && room.members.every((member) => member.ready);

  const fetchRoom = useCallback(async () => {
    const response = await fetch(`/api/lounge/rooms/${initialRoom.id}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as { room?: WatchRoomSnapshot; error?: string };
    if (!response.ok || !payload.room) { setError(payload.error ?? "The room could not be refreshed"); return null; }
    setRoom(payload.room); setError("");
    return payload.room;
  }, [initialRoom.id]);

  const sendPresence = useCallback(async (state = presenceState.current) => {
    if (!room.joined) return;
    presenceState.current = state;
    await fetch(`/api/lounge/rooms/${room.id}/presence`, {
      method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, position: playerRef.current?.currentTime ?? room.position }),
    }).catch(() => null);
  }, [room.id, room.joined, room.position]);

  const saveProgress = useCallback(async (force = false) => {
    const player = playerRef.current;
    if (!player || !Number.isFinite(player.currentTime)) return;
    if (!force && Math.abs(player.currentTime - lastSaved.current) < 10) return;
    lastSaved.current = player.currentTime;
    await fetch(`/api/media/${room.media.id}/progress`, {
      method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: player.currentTime, duration: Number.isFinite(player.duration) ? player.duration : null }),
    }).catch(() => null);
  }, [room.media.id]);

  useEffect(() => {
    const events = new EventSource(`/api/lounge/rooms/${room.id}/events`);
    events.onopen = () => setConnection("live");
    events.onerror = () => setConnection("reconnecting");
    events.addEventListener("room", () => void fetchRoom());
    const refresh = setInterval(() => void fetchRoom(), 5_000);
    return () => { clearInterval(refresh); events.close(); };
  }, [fetchRoom, room.id]);

  useEffect(() => {
    if (!room.joined) return;
    void sendPresence();
    const heartbeat = setInterval(() => void sendPresence(), 7_500);
    return () => clearInterval(heartbeat);
  }, [room.joined, sendPresence]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: "nearest" });
  }, [room.messages]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !room.joined) return;
    const target = player;
    let cancelled = false;
    setLoaded(false); setError("");
    async function attach() {
      if (room.media.playbackMode === "direct") {
        target.src = `/api/media/${room.media.id}/stream`;
        return;
      }
      const manifest = `/api/media/${room.media.id}/hls/index.m3u8`;
      if (target.canPlayType("application/vnd.apple.mpegurl")) { target.src = manifest; return; }
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (!Hls.isSupported()) { setError("This browser cannot play the converted stream."); return; }
      const hls = new Hls({ enableWorker: true, maxBufferLength: 30, manifestLoadingMaxRetry: 6, levelLoadingMaxRetry: 6, fragLoadingMaxRetry: 8 });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) setError("Vanta could not continue this shared stream."); });
      hls.loadSource(manifest); hls.attachMedia(target);
    }
    void attach().catch((reason) => setError(reason instanceof Error ? reason.message : "Playback failed"));
    return () => { cancelled = true; hlsRef.current?.destroy(); hlsRef.current = null; target.removeAttribute("src"); target.load(); };
  }, [room.joined, room.media.id, room.media.playbackMode]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !loaded || !room.joined) return;
    const clockOffset = Date.now() - room.serverNow;
    const localStateAt = room.stateUpdatedAt + clockOffset;
    const localPlayAt = room.playAt ? room.playAt + clockOffset : null;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let displayTimer: ReturnType<typeof setTimeout> | null = null;

    const apply = () => {
      const now = Date.now();
      const baseAt = localPlayAt ?? localStateAt;
      const expected = room.status === "playing" ? room.position + Math.max(0, now - baseAt) / 1000 : room.position;
      remoteUntil.current = now + 1_000;
      const drift = expected - player.currentTime;
      if (Math.abs(drift) > 1.25) player.currentTime = Math.max(0, expected);
      player.playbackRate = Math.abs(drift) > 0.2 && Math.abs(drift) <= 1.25 ? (drift > 0 ? 1.05 : 0.95) : 1;
      if (room.status === "playing") {
        void player.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
      } else {
        player.pause(); setNeedsGesture(false);
      }
    };

    if (room.status === "playing" && localPlayAt && localPlayAt > Date.now()) {
      remoteUntil.current = Date.now() + 1_000; player.pause();
      const updateCountdown = () => setCountdown(Math.max(1, Math.ceil((localPlayAt - Date.now()) / 1000)));
      displayTimer = setTimeout(updateCountdown, 0); countdownTimer = setInterval(updateCountdown, 100);
      startTimer = setTimeout(() => { setCountdown(null); apply(); }, Math.max(0, localPlayAt - Date.now()));
    } else { displayTimer = setTimeout(() => { setCountdown(null); apply(); }, 0); }
    return () => { if (countdownTimer) clearInterval(countdownTimer); if (startTimer) clearTimeout(startTimer); if (displayTimer) clearTimeout(displayTimer); };
  }, [loaded, room.duration, room.joined, room.playAt, room.position, room.serverNow, room.stateUpdatedAt, room.status]);

  async function request(path: string, method: string, body?: unknown) {
    setLoading(true); setError("");
    const response = await fetch(`/api/lounge/rooms/${room.id}/${path}`, {
      method, headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);
    if (!response.ok) { setError(payload.error ?? "The room could not be updated"); return false; }
    await fetchRoom(); return true;
  }

  async function join() { await request("join", "POST"); }
  async function ready() { await request("ready", "PATCH", { ready: !room.ready }); }

  async function control(action: ControlAction, position = playerRef.current?.currentTime ?? room.position) {
    const player = playerRef.current;
    await request("control", "POST", {
      action,
      position: Number.isFinite(position) ? position : 0,
      duration: player && Number.isFinite(player.duration) && player.duration > 0 ? player.duration : room.duration,
    });
  }

  async function localControl(action: "play" | "pause" | "seek") {
    if (Date.now() < remoteUntil.current) return;
    if (!canControl) { const latest = await fetchRoom(); if (latest) remoteUntil.current = Date.now() + 1_000; return; }
    await control(action);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await request("messages", "POST", { kind: "message", body: data.get("message") })) form.reset();
  }

  async function react(body: string) { await request("messages", "POST", { kind: "reaction", body }); }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 1_500);
  }

  const member = room.members.find((person) => person.userId === user.id);

  return (
    <main className="watch-room-shell">
      <header className="watch-room-nav">
        <Link href="/lounge"><ArrowLeft />Lounge</Link>
        <div><small>{room.media.kind === "series" ? room.media.title : "WATCH TOGETHER"}</small><strong>{title(room)}</strong></div>
        <span className={`room-connection ${connection}`}><i />{connection === "live" ? "Live room" : connection === "connecting" ? "Connecting" : "Reconnecting"}</span>
      </header>

      <div className="watch-room-layout">
        <section className="watch-stage">
          <video
            ref={playerRef}
            controls={room.joined && room.status !== "waiting" && room.status !== "ended"}
            playsInline
            poster={room.media.backdropUrl ?? room.media.posterUrl ?? undefined}
            onLoadedMetadata={() => setLoaded(true)}
            onCanPlay={() => { setLoaded(true); if (presenceState.current === "buffering") void sendPresence(room.status === "playing" ? "playing" : "paused"); }}
            onWaiting={() => void sendPresence("buffering")}
            onPlaying={() => { void sendPresence("playing"); void localControl("play"); }}
            onPause={() => { void saveProgress(true); void sendPresence(room.status === "waiting" && room.ready ? "ready" : "paused"); void localControl("pause"); }}
            onSeeked={() => void localControl("seek")}
            onTimeUpdate={() => void saveProgress()}
            onEnded={() => { void saveProgress(true); if (canControl) void control("pause"); }}
          />
          {!room.joined && <div className="watch-gate"><Users /><span className="eyebrow">PRIVATE INVITATION</span><h1>{room.hostDisplayName} invited you.</h1><p>Join the room to load <strong>{title(room)}</strong>, see the conversation and synchronize with everyone.</p><button className="primary-button" onClick={() => void join()} disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />}Join Watch Together</button></div>}
          {room.joined && room.status === "waiting" && <div className="watch-waiting"><Radio /><span className="eyebrow">ROOM LOBBY</span><h2>{room.ready ? "You’re ready." : "Settle in, then ready up."}</h2><p>{everyoneReady ? "Everyone in the room is ready for the countdown." : "Playback stays parked until the group is ready and the host starts it."}</p></div>}
          {countdown !== null && <div className="watch-countdown"><small>STARTING TOGETHER</small><strong>{countdown}</strong></div>}
          {needsGesture && <button className="watch-gesture" onClick={() => void playerRef.current?.play()}><Play fill="currentColor" />Tap to join synchronized playback</button>}
          {room.status === "ended" && <div className="watch-ended"><CircleStop /><h2>This room has ended.</h2><Link className="primary-button" href="/lounge">Back to Lounge</Link></div>}
          {!loaded && room.joined && !error && <div className="watch-loading"><LoaderCircle className="spin" />Preparing the shared stream…</div>}
          {error && <div className="watch-error">{error}</div>}
          {room.joined && <div className="watch-toolbar">
            <div><span className={member?.ready ? "ready-dot active" : "ready-dot"}><Check /></span><button className={room.ready ? "secondary-button active" : "secondary-button"} onClick={() => void ready()} disabled={loading}>{room.ready ? "Ready" : "I’m ready"}</button></div>
            <div className="watch-position"><Clock3 />{clock(room.position)}{room.duration ? ` / ${clock(room.duration)}` : ""}</div>
            <div>{room.isHost && room.status === "waiting" && <button className="primary-button" disabled={!everyoneReady || loading} onClick={() => void control("start", 0)}><Play fill="currentColor" />Start together</button>}{room.isHost && room.status !== "ended" && <button className="watch-end-button" onClick={() => window.confirm("End this room for everyone?") && void control("end")}><CircleStop />End room</button>}</div>
          </div>}
        </section>

        <aside className="watch-social">
          <section className="room-summary"><div><span className="eyebrow">{room.isHost ? "YOUR ROOM" : `${room.hostDisplayName.toUpperCase()}’S ROOM`}</span><h2>{title(room)}</h2></div><button onClick={() => void copyLink()} title="Copy room link">{copied ? <Check /> : <Copy />}</button><p><ShieldCheck />Invite-only · {room.controlMode === "host" ? "Host controls playback" : "Everyone can control"}</p></section>

          <section className="room-people"><header><h3><Users />In the room</h3><span>{room.members.filter((person) => person.online).length} online</span></header><div>{room.members.map((person) => <article key={person.userId}><span className="room-avatar">{person.displayName.slice(0, 1).toUpperCase()}<i className={person.online ? "online" : ""} /></span><div><strong>{person.displayName}{person.userId === user.id ? " (you)" : ""}</strong><small>{person.playbackState === "buffering" ? "Buffering…" : person.ready ? "Ready" : person.online ? "Getting settled" : "Away"}</small></div>{person.isHost ? <Crown className="host-crown" /> : person.ready ? <Check className="member-ready" /> : null}</article>)}</div></section>

          <section className="room-chat"><header><h3><MessageCircle />Room chat</h3></header><div className="room-messages">{room.messages.length ? room.messages.map((message) => message.kind === "reaction" ? <div className="reaction-message" key={message.id}><span>{message.body}</span><small>{message.displayName}</small></div> : <article className={message.userId === user.id ? "own" : ""} key={message.id}><div><strong>{message.displayName}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.body}</p></article>) : <div className="chat-empty">The room is open. Say hello.</div>}<div ref={messagesEnd} /></div>
            {room.joined && <><div className="quick-reactions">{ROOM_REACTIONS.map((reaction) => <button key={reaction} onClick={() => void react(reaction)}>{reaction}</button>)}</div><form className="room-message-form" onSubmit={sendMessage}><input name="message" maxLength={500} placeholder="Message the room" autoComplete="off" /><button aria-label="Send message"><Send /></button></form></>}
          </section>
        </aside>
      </div>
    </main>
  );
}
