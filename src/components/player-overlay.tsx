"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, LoaderCircle, Music2, X } from "lucide-react";
import type HlsType from "hls.js";
import type { MediaItem } from "@/lib/types";

export function PlayerOverlay({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const lastSaved = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const saveProgress = useCallback(async (force = false) => {
    const player = mediaRef.current;
    if (!player || !Number.isFinite(player.currentTime)) return;
    if (!force && Math.abs(player.currentTime - lastSaved.current) < 10) return;
    lastSaved.current = player.currentTime;
    await fetch(`/api/media/${item.id}/progress`, {
      method: "PUT",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: player.currentTime, duration: Number.isFinite(player.duration) ? player.duration : null }),
    }).catch(() => null);
  }, [item.id]);

  useEffect(() => {
    const player = mediaRef.current;
    if (!player) return;
    const target = player;
    let cancelled = false;
    async function attach() {
      if (item.playbackMode === "direct") {
        target.src = `/api/media/${item.id}/stream`;
        return;
      }
      const manifest = `/api/media/${item.id}/hls/index.m3u8`;
      if (target.canPlayType("application/vnd.apple.mpegurl")) {
        target.src = manifest;
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (!Hls.isSupported()) {
        setError("This browser cannot play the converted stream.");
        return;
      }
      const hls = new Hls({ enableWorker: true, maxBufferLength: 30, manifestLoadingMaxRetry: 6, levelLoadingMaxRetry: 6, fragLoadingMaxRetry: 8 });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError(data.response?.code === 503 ? "FFmpeg could not prepare this title. Check the server logs." : "Vanta could not continue this stream.");
      });
      hls.loadSource(manifest);
      hls.attachMedia(target);
    }
    attach().catch((reason) => setError(reason instanceof Error ? reason.message : "Playback failed"));
    return () => { cancelled = true; hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [item.id, item.playbackMode]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { void saveProgress(true); onClose(); }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose, saveProgress]);

  function ready() {
    const player = mediaRef.current;
    if (!player) return;
    if (item.progress > 5 && (!player.duration || item.progress < player.duration * 0.92)) player.currentTime = item.progress;
    setLoading(false);
    void player.play().catch(() => null);
  }

  async function close() { await saveProgress(true); onClose(); }

  const mediaProps = {
    ref: (node: HTMLMediaElement | null) => { mediaRef.current = node; },
    controls: true,
    autoPlay: true,
    onLoadedMetadata: ready,
    onCanPlay: () => setLoading(false),
    onTimeUpdate: () => void saveProgress(),
    onPause: () => void saveProgress(true),
    onEnded: () => void saveProgress(true),
  };

  return (
    <div className="player-overlay" role="dialog" aria-modal="true" aria-label={`Playing ${item.title}`}>
      <div className="player-topbar"><div><span>{item.kind === "music" ? item.artist ?? "Now playing" : item.seriesTitle ?? "Now playing"}</span><strong>{item.title}</strong></div><button onClick={() => void close()} aria-label="Close player"><X /></button></div>
      {item.kind === "music" ? (
        <div className="audio-stage">
          <div className="album-art" style={item.posterUrl ? { backgroundImage: `url("${item.posterUrl}")` } : undefined}>{!item.posterUrl && <Music2 size={72} />}</div>
          <div className="audio-details"><span>{item.album ?? "From your music library"}</span><h2>{item.title}</h2><p>{item.artist ?? "Unknown artist"}</p></div>
          <audio {...mediaProps} />
        </div>
      ) : (
        <video {...mediaProps} playsInline />
      )}
      {loading && !error && <div className="player-status"><LoaderCircle className="spin" size={34} /><p>{item.playbackMode === "hls" ? "Preparing for this device…" : "Opening stream…"}</p></div>}
      {error && <div className="player-status player-error"><AlertTriangle size={34} /><h3>Playback stopped</h3><p>{error}</p><button className="secondary-button" onClick={() => void close()}>Close player</button></div>}
    </div>
  );
}
