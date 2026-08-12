FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    VANTA_DATA_DIR=/data \
    VANTA_CACHE_DIR=/data/cache
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates python3 python3-pip \
    && python3 -m pip install --break-system-packages --no-cache-dir --pre "yt-dlp[default]" \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 vanta \
    && useradd --system --uid 1001 --gid vanta vanta \
    && mkdir -p /data /media /storage \
    && chown -R vanta:vanta /data /media /storage /app
COPY --from=builder --chown=vanta:vanta /app/.next/standalone ./
USER vanta
EXPOSE 3000
VOLUME ["/data", "/media", "/storage"]
CMD ["node", "server.js"]
