"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Film, FolderOpen, Gamepad2, Heart, Home, LogOut, Menu, Music2,
  Play, Search, Settings, Sparkles, Tv, X, Zap,
} from "lucide-react";
import { VantaMark } from "@/components/brand";
import type { ArcadeFeed, GameItem, SafeUser } from "@/lib/types";

type Direction = "up" | "down" | "left" | "right";

function focusInDirection(direction: Direction) {
  const targets = [...document.querySelectorAll<HTMLElement>("[data-arcade-focus]")]
    .filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
  if (!targets.length) return;
  const current = targets.includes(document.activeElement as HTMLElement)
    ? document.activeElement as HTMLElement
    : targets[0];
  if (document.activeElement !== current) { current.focus(); return; }
  const source = current.getBoundingClientRect();
  const sourceX = source.left + source.width / 2;
  const sourceY = source.top + source.height / 2;
  const candidates = targets.filter((target) => target !== current).map((target) => {
    const rect = target.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - sourceX;
    const dy = rect.top + rect.height / 2 - sourceY;
    const valid = direction === "left" ? dx < -8 : direction === "right" ? dx > 8 : direction === "up" ? dy < -8 : dy > 8;
    const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    return { target, valid, score: primary + secondary * 2.25 };
  }).filter((candidate) => candidate.valid).sort((left, right) => left.score - right.score);
  candidates[0]?.target.focus();
}

function useArcadeControls() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const updateConnection = () => setConnected(Boolean(navigator.getGamepads?.().some(Boolean)));
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input, textarea, select")) return;
      const direction = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as const)[event.key];
      if (direction) { event.preventDefault(); focusInDirection(direction); }
    };
    window.addEventListener("gamepadconnected", updateConnection);
    window.addEventListener("gamepaddisconnected", updateConnection);
    window.addEventListener("keydown", keydown);
    updateConnection();

    let frame = 0;
    let previous = new Set<string>();
    const poll = () => {
      const gamepad = navigator.getGamepads?.().find(Boolean);
      if (gamepad) {
        const pressed = new Set<string>();
        if (gamepad.buttons[12]?.pressed || (gamepad.axes[1] ?? 0) < -0.65) pressed.add("up");
        if (gamepad.buttons[13]?.pressed || (gamepad.axes[1] ?? 0) > 0.65) pressed.add("down");
        if (gamepad.buttons[14]?.pressed || (gamepad.axes[0] ?? 0) < -0.65) pressed.add("left");
        if (gamepad.buttons[15]?.pressed || (gamepad.axes[0] ?? 0) > 0.65) pressed.add("right");
        if (gamepad.buttons[0]?.pressed) pressed.add("select");
        for (const action of pressed) {
          if (previous.has(action)) continue;
          if (action === "select") (document.activeElement as HTMLElement | null)?.click();
          else focusInDirection(action as Direction);
        }
        previous = pressed;
      } else previous = new Set();
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("gamepadconnected", updateConnection);
      window.removeEventListener("gamepaddisconnected", updateConnection);
      window.removeEventListener("keydown", keydown);
    };
  }, []);
  return connected;
}

function GameCard({ game, favorite, onFavorite }: {
  game: GameItem;
  favorite: boolean;
  onFavorite: (game: GameItem, favorite: boolean) => void;
}) {
  return (
    <article className={`game-card-shell system-${game.system}`}>
      <Link className="game-card" href={`/arcade/play/${game.id}`} data-arcade-focus>
        <span className="game-cover" style={game.coverUrl ? { backgroundImage: `url("${game.coverUrl}")` } : undefined}>
          {!game.coverUrl && <span className="game-cover-fallback"><Gamepad2 /><b>{game.systemLabel}</b><strong>{game.title}</strong></span>}
          <span className="game-play"><Play fill="currentColor" /></span>
        </span>
        <span className="game-copy"><strong>{game.title}</strong><small>{game.systemLabel} · {game.extension}</small></span>
      </Link>
      <button className={favorite ? "game-favorite active" : "game-favorite"} onClick={() => onFavorite(game, !favorite)} aria-label={`${favorite ? "Remove" : "Add"} ${game.title} ${favorite ? "from" : "to"} favorites`}><Heart fill={favorite ? "currentColor" : "none"} /></button>
    </article>
  );
}

function GameShelf({ title, icon, games, favorites, onFavorite }: {
  title: string;
  icon?: ReactNode;
  games: GameItem[];
  favorites: Set<string>;
  onFavorite: (game: GameItem, favorite: boolean) => void;
}) {
  if (!games.length) return null;
  return <section className="arcade-shelf"><div className="arcade-shelf-heading"><h2>{icon}{title}</h2><span>{games.length} games</span></div><div className="game-row">{games.map((game) => <GameCard key={game.id} game={game} favorite={favorites.has(game.id)} onFavorite={onFavorite} />)}</div></section>;
}

export function ArcadeShell({ user, feed }: { user: SafeUser; feed: ArcadeFeed }) {
  const router = useRouter();
  const controllerConnected = useArcadeControls();
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState("all");
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(feed.favorites.map((game) => game.id)));
  const [mobileMenu, setMobileMenu] = useState(false);
  const systems = useMemo(() => [...new Map(feed.games.map((game) => [game.system, game.systemLabel])).entries()], [feed.games]);
  const visible = feed.games.filter((game) =>
    (system === "all" || game.system === system) && game.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const featured = feed.recentlyPlayed[0] ?? feed.games[0] ?? null;

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  async function favorite(game: GameItem, next: boolean) {
    setFavoriteIds((current) => { const updated = new Set(current); if (next) updated.add(game.id); else updated.delete(game.id); return updated; });
    const response = await fetch(`/api/games/${game.id}/activity`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite: next }) });
    if (!response.ok) setFavoriteIds((current) => { const updated = new Set(current); if (next) updated.delete(game.id); else updated.add(game.id); return updated; });
  }

  return (
    <div className="arcade-shell">
      <header className="top-nav arcade-nav">
        <Link href="/browse" className="brand-link"><VantaMark /></Link>
        <nav className={mobileMenu ? "nav-links nav-links-open" : "nav-links"}>
          <Link href="/browse"><Home />Home</Link><Link href="/browse?view=movies"><Film />Movies</Link><Link href="/browse?view=series"><Tv />Series</Link><Link href="/browse?view=music"><Music2 />Music</Link><Link href="/files"><FolderOpen />Files</Link><Link href="/arcade" className="active"><Gamepad2 />Arcade</Link>
        </nav>
        <div className="nav-actions"><span className={controllerConnected ? "controller-status connected" : "controller-status"}><Gamepad2 />{controllerConnected ? "Controller ready" : "Connect controller"}</span>{user.role === "admin" && <Link href="/admin" aria-label="Server settings"><Settings /></Link>}<div className="user-menu"><button className="avatar" title={user.displayName}>{user.displayName.slice(0, 1).toUpperCase()}</button><div className="user-popover"><strong>{user.displayName}</strong><span>{user.role === "admin" ? "Vanta owner" : "Player"}</span><button onClick={() => void logout()}><LogOut />Sign out</button></div></div><button className="mobile-menu-button" onClick={() => setMobileMenu((open) => !open)} aria-label="Open menu">{mobileMenu ? <X /> : <Menu />}</button></div>
      </header>

      {!feed.games.length ? <main className="arcade-empty"><span><Gamepad2 /></span><small>VANTA ARCADE</small><h1>The cabinets are waiting.</h1><p>Connect a folder containing ROMs you legally own, or install Vanta&apos;s free NES demo from the control room.</p>{user.role === "admin" ? <Link className="primary-button" href="/admin"><Zap />Set up Arcade</Link> : <p>Ask the Vanta owner to connect a game library.</p>}</main> : <main>
        {featured && <section className={`arcade-hero system-${featured.system}`} style={featured.backgroundUrl || featured.coverUrl ? { backgroundImage: `url("${featured.backgroundUrl ?? featured.coverUrl}")` } : undefined}><div className="arcade-hero-grid" /><div className="arcade-hero-shade" /><div className="arcade-hero-content"><span className="eyebrow"><Sparkles /> {featured.lastPlayedAt ? "CONTINUE PLAYING" : "INSERT COIN"}</span><h1>{featured.title}</h1><p>{featured.systemLabel} · Runs privately in your browser with keyboard, touch or a connected gamepad.</p><div><Link className="primary-button" href={`/arcade/play/${featured.id}`} data-arcade-focus><Play fill="currentColor" />{featured.lastPlayedAt ? "Continue" : "Play now"}</Link><span className="arcade-save-note">Browser save memory enabled</span></div></div></section>}
        <div className="arcade-content">
          <div className="arcade-toolbar"><div><span className="eyebrow">YOUR GAME ROOM</span><h2>Pick a cabinet.</h2></div><label className="arcade-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games" /></label></div>
          <div className="system-filters"><button className={system === "all" ? "active" : ""} onClick={() => setSystem("all")} data-arcade-focus>All systems</button>{systems.map(([id, label]) => <button key={id} className={system === id ? "active" : ""} onClick={() => setSystem(id)} data-arcade-focus>{label}</button>)}</div>
          {!query && system === "all" && <><GameShelf title="Continue playing" icon={<Zap />} games={feed.recentlyPlayed} favorites={favoriteIds} onFavorite={(game, value) => void favorite(game, value)} /><GameShelf title="Favorites" icon={<Heart />} games={feed.games.filter((game) => favoriteIds.has(game.id))} favorites={favoriteIds} onFavorite={(game, value) => void favorite(game, value)} /></>}
          <GameShelf title={query || system !== "all" ? "Results" : "All games"} games={visible} favorites={favoriteIds} onFavorite={(game, value) => void favorite(game, value)} />
          {!visible.length && <div className="arcade-no-results"><Gamepad2 /><strong>No games found</strong><span>Try another title or system.</span></div>}
        </div>
      </main>}

      <nav className="bottom-nav arcade-bottom-nav"><Link href="/browse"><Home /><span>Home</span></Link><Link href="/browse?view=movies"><Film /><span>Movies</span></Link><Link href="/browse?view=series"><Tv /><span>Series</span></Link><Link href="/browse?view=music"><Music2 /><span>Music</span></Link><Link href="/files"><FolderOpen /><span>Files</span></Link><Link className="active" href="/arcade"><Gamepad2 /><span>Arcade</span></Link></nav>
    </div>
  );
}
