# Vanta

**Your world, on demand.**

Vanta is a private, self-hosted home for movies, TV series, music, retro games and ordinary files. Point it at folders on your server and it turns them into a polished streaming library, browser arcade and private NAS workspace for the people you trust. Your data stays on your hardware.

The current release combines the media foundation with the first functional NAS workspace. Plex is not required; Vanta scans, streams and manages its own configured folders.

## What already works

- Cinematic, responsive interface for desktop, TV-sized displays and mobile
- First-run owner setup and password-protected sessions
- Separate viewer accounts managed by the owner
- Movie, TV series and music libraries backed by ordinary folders
- Recursive scanning without changing original files
- Filename parsing for release names, `S01E02` episodes and music folders
- Local `poster.jpg`, `fanart.jpg`, `folder.jpg` and sidecar artwork support
- Optional TMDB posters, backdrops and summaries
- HTTP range streaming for browser-native media
- Automatic FFmpeg-to-HLS conversion for formats such as MKV and AVI
- Resume position, completion tracking and continue-watching rows
- Search across titles, series, artists and albums
- Controller-first Arcade with search, system filters, favourites and recent games
- Self-hosted [EmulatorJS](https://emulatorjs.org/) runtime with 21 selected emulator cores
- Per-user Arcade activity plus browser-local save states and game saves
- Owner-managed ROM folders, optional BIOS files and one verified open-source NES demo
- Owner-only YouTube search and authorised audio import into artist/album folders
- Private and shared file-storage locations backed by ordinary server folders
- Folder browsing, multi-file streaming uploads, downloads and rename operations
- Recoverable deletion into a hidden `.vanta-trash` folder rather than permanent erasure
- Storage capacity and free-space visibility
- Docker and native Node.js operation

## Quick start with Docker

1. Install Docker Desktop or Docker Engine with Compose.
2. Edit the host paths in `docker-compose.yml` so they point at your media, storage and game folders.
3. Start Vanta:

```bash
docker compose up -d --build
```

4. Open `http://localhost:3000` on the server, or `http://SERVER-IP:3000` from another device on your home network.
5. Create the owner account, open the control room, and add these container paths:

```text
/media/movies
/media/series
/media/music
/storage
/games
```

The movie, series and games mounts use `:ro`, so they stay read-only inside Vanta. The music mount is writable to support authorised YouTube imports, and `/storage` is writable for Vanta Files. Vanta's database, generated playback cache and optional free demo live in `./data` and survive container restarts.

Open **Files → Connect storage** and use `/storage` as the folder path. You can connect more mounted folders later.

## Run directly on Windows, macOS or Linux

Vanta requires Node.js 22+ and FFmpeg. YouTube search/import also requires [yt-dlp](https://github.com/yt-dlp/yt-dlp); the official project currently recommends its nightly channel for regular users. FFmpeg and yt-dlp only need to be on `PATH` unless their environment variables point somewhere else.

One supported way to install the current yt-dlp nightly is:

```bash
python -m pip install -U --pre "yt-dlp[default]"
```

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create the owner account, and enter normal paths from the server itself in the control room—for example `D:\Media\Movies` on Windows or `/mnt/media/movies` on Linux.

For a production build:

```bash
npm run build
npm start
```

## Organising media

Vanta is deliberately forgiving. These patterns produce the best names:

```text
Movies/
  Dune Part Two (2024)/Dune.Part.Two.2024.2160p.mkv
  Arrival (2016)/Arrival.2016.mp4

Series/
  The Expanse/Season 03/The.Expanse.S03E06.Immolation.mkv
  Red Dwarf/Season 01/Red.Dwarf.S01E01.The.End.mp4

Music/
  Massive Attack/Mezzanine/01 Angel.flac
  Daft Punk/Discovery/01 One More Time.mp3
```

Put local artwork next to a title using any of these names:

- `poster.jpg`, `folder.jpg` or `cover.jpg` for portrait artwork
- `fanart.jpg`, `backdrop.jpg` or `background.jpg` for landscape artwork
- A matching sidecar such as `Arrival.2016.jpg`

Set `TMDB_API_KEY` to enrich movies and series that do not have local artwork. This product uses the TMDB API but is not endorsed or certified by TMDB.

## Add games to Arcade

Open **Control room → Arcade libraries**, choose a system and connect the folder containing ROMs you are legally entitled to use. In Docker, use a path below `/games`; in a direct installation, use the normal path on the server. Vanta scans supported files recursively and never modifies the originals.

Artwork can sit beside a ROM as `Game Name.jpg`, `Game Name.png` or `Game Name.webp`. A matching `Game Name-background.jpg`, `cover.jpg`, `folder.jpg`, `background.jpg` or `fanart.jpg` is also recognised. Systems that require firmware can be given an optional BIOS file when the library is connected.

The Arcade can be navigated with a mouse, keyboard or gamepad. Directional controls move focus and the primary gamepad button opens the focused item. Emulator saves and save states are isolated by Vanta user and game, but are currently stored in that browser rather than synced back to the server.

**Install free demo** adds the [NES Starter Kit](https://github.com/igwgames/nes-starter-kit) example game. Vanta verifies its pinned SHA-256 before saving it. The example code is MIT licensed and its bundled art/music resources are CC0. Vanta does not include, discover or download commercial ROMs.

## Import authorised audio from YouTube

Open **Control room → YouTube Import**, search for a song or performance, and choose **Import audio**. Vanta asks you for:

- the writable music library to use
- artist, album and track title
- confirmation that you own the content, have permission, or it is licensed for downloading

Vanta extracts the best available audio to MP3, embeds the source metadata, keeps a matching JPG thumbnail as cover art and saves it as:

```text
Music Library/Artist/Album/Track title.mp3
Music Library/Artist/Album/Track title.jpg
```

The music library is rescanned automatically, so the track immediately becomes part of that artist and album in the gallery. Search and import are available only to the Vanta owner.

This feature does not grant rights to YouTube content or override YouTube's terms. Use it only where the creator, licence or your ownership permits downloading. It intentionally does not accept arbitrary server output paths or playlists.

## Use Vanta as private file storage

Open **Files** and connect any existing folder on the server. Each location can be:

- **Owner only** — completely hidden from viewer accounts
- **Shared** — viewers can browse and download; only the owner can make changes
- **Writable or read-only** — writable locations enable uploads, folders, renaming and recovery

Vanta confines every operation to the configured storage root, ignores symbolic links and never exposes the server path to viewers. Moving an item to trash places it inside a hidden `.vanta-trash` directory at the root. Vanta intentionally does not permanently empty that directory yet; inspect or back it up on the server before removing anything from it manually.

Uploads stream directly to disk instead of buffering the entire file in memory. The default per-file limit is 20 GiB and can be changed with `VANTA_MAX_UPLOAD_BYTES`. If Vanta is behind a reverse proxy, its request-body limit and timeout must be at least as large as Vanta's.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VANTA_DATA_DIR` | `./data` | SQLite database and persistent application data |
| `VANTA_CACHE_DIR` | `./data/cache` | Generated HLS playback files |
| `VANTA_SECURE_COOKIES` | `false` | Set to `true` when Vanta is served over HTTPS |
| `TMDB_API_KEY` | unset | Optional movie and series metadata |
| `FFMPEG_PATH` | `ffmpeg` | FFmpeg executable path |
| `YTDLP_PATH` | `yt-dlp` | yt-dlp executable path for YouTube search/import |
| `VANTA_MAX_UPLOAD_BYTES` | `21474836480` | Maximum size of each Files upload (20 GiB) |
| `VANTA_TRANSCODE_PRESET` | `veryfast` | FFmpeg x264 speed/quality preset |
| `VANTA_TRANSCODE_CRF` | `21` | FFmpeg x264 quality value; lower is higher quality |
| `PORT` | `3000` | HTTP port for production |

## Remote access and domains

Do not expose port 3000 directly to the public internet. Put Vanta behind HTTPS using a reverse proxy such as Caddy, Nginx or Cloudflare Tunnel, then set `VANTA_SECURE_COOKIES=true`. A private mesh VPN such as Tailscale is also a good fit for family-only access.

The application checks authorization again at every media, ROM, BIOS, artwork, progress, library, file and account endpoint. Stored Arcade paths are resolved and confined again when served, so a file swapped for a symbolic link is rejected. Server paths are never included in viewer-facing objects.

Only download, store and share media you have the legal right to use. Viewer accounts are intended for private household/family use, not running a public streaming service.

## Development

```bash
npm run lint
npm test
npm run build
# or all three
npm run check
```

The main layers are:

```text
src/app/             Next.js pages and protected route handlers
src/components/      Interactive browse, playback and control-room UI
src/server/auth.ts   Users, sessions and authorization
src/server/media/    Filename parsing, scanning, metadata and queries
src/server/playback.ts  Byte ranges and FFmpeg HLS preparation
src/server/files.ts     Storage-root jailing and file operations
src/server/games.ts     ROM scanning, Arcade activity and protected assets
scripts/prepare-emulator.mjs  Selected self-hosted EmulatorJS assets
data/                Runtime SQLite database and cache (gitignored)
```

## Roadmap

- Recovery-bin browser and explicit restore/permanent-delete controls
- Drag-and-drop uploads and resumable transfer sessions
- Per-location and per-folder sharing rules
- Viewer password changes and invitation links
- Automatic scheduled scans and filesystem watching
- Subtitle discovery and track selection
- Hardware-accelerated transcoding profiles
- Native TV/PWA install experience
- Collections, playlists and favourites

Vanta is early software. Keep a backup of its `data` folder, and always keep irreplaceable original media backed up separately.
