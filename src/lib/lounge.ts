import type { WatchRoomStatus } from "@/lib/types";

export const ROOM_REACTIONS = ["❤️", "😂", "😮", "👏", "🍿", "👀"] as const;

export function roomPlaybackPosition(input: {
  status: WatchRoomStatus;
  position: number;
  stateUpdatedAt: number;
  playAt: number | null;
  now: number;
  duration: number | null;
}) {
  const startedAt = input.playAt ?? input.stateUpdatedAt;
  const elapsed = input.status === "playing" ? Math.max(0, input.now - startedAt) / 1000 : 0;
  const position = Math.max(0, input.position + elapsed);
  return input.duration && input.duration > 0 ? Math.min(position, input.duration) : position;
}

export function cleanRoomMessage(value: unknown) {
  if (typeof value !== "string") throw new Error("Write a message first");
  const message = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!message) throw new Error("Write a message first");
  if (message.length > 500) throw new Error("Keep messages under 500 characters");
  return message;
}

export function isRoomReaction(value: unknown): value is (typeof ROOM_REACTIONS)[number] {
  return typeof value === "string" && (ROOM_REACTIONS as readonly string[]).includes(value);
}
