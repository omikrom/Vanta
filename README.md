# Vanta

**Your world, on demand.**

Vanta is a private, self-hosted home for movies, TV series and music. Point it at folders on your server and it turns them into a polished streaming library for the people you trust. Your media stays on your hardware and Vanta never moves or deletes the original files.

The current release is the media foundation for a wider home-server platform. Private file storage, uploads, downloads and NAS management are represented in the product now and planned as the next major phase.

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
- Owner-only YouTube search and authorised audio import into artist/album folders
- Docker and native Node.js operation

## Quick start with Docker

1. Install Docker Desktop or Docker Engine with Compose.
2. Edit the three host paths in `docker-compose.yml` so they point at your media folders.
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
```

The movie and series mounts use `:ro`, so they stay read-only inside Vanta. The music mount is writable to support authorised YouTube imports. Vanta's database and generated playback cache live in `./data` and survive container restarts.

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

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VANTA_DATA_DIR` | `./data` | SQLite database and persistent application data |
| `VANTA_CACHE_DIR` | `./data/cache` | Generated HLS playback files |
| `VANTA_SECURE_COOKIES` | `false` | Set to `true` when Vanta is served over HTTPS |
| `TMDB_API_KEY` | unset | Optional movie and series metadata |
| `FFMPEG_PATH` | `ffmpeg` | FFmpeg executable path |
| `YTDLP_PATH` | `yt-dlp` | yt-dlp executable path for YouTube search/import |
| `VANTA_TRANSCODE_PRESET` | `veryfast` | FFmpeg x264 speed/quality preset |
| `VANTA_TRANSCODE_CRF` | `21` | FFmpeg x264 quality value; lower is higher quality |
| `PORT` | `3000` | HTTP port for production |

## Remote access and domains

Do not expose port 3000 directly to the public internet. Put Vanta behind HTTPS using a reverse proxy such as Caddy, Nginx or Cloudflare Tunnel, then set `VANTA_SECURE_COOKIES=true`. A private mesh VPN such as Tailscale is also a good fit for family-only access.

The application checks authorization again at every media, artwork, progress, library and account endpoint. Server paths are never included in browser-facing media objects.

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
data/                Runtime SQLite database and cache (gitignored)
```

## Roadmap

- File explorer with upload, download and folders
- Storage health and disk usage
- Viewer password changes and invitation links
- Automatic scheduled scans and filesystem watching
- Subtitle discovery and track selection
- Hardware-accelerated transcoding profiles
- Native TV/PWA install experience
- Collections, playlists and favourites

Vanta is early software. Keep a backup of its `data` folder, and always keep irreplaceable original media backed up separately.
