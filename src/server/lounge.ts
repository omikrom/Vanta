import "server-only";

import { randomUUID } from "node:crypto";
import { cleanRoomMessage, isRoomReaction, roomPlaybackPosition } from "@/lib/lounge";
import type {
  LoungeFeed, LoungePerson, MediaItem, SafeUser, WatchPresenceState,
  WatchRoomControlMode, WatchRoomMember, WatchRoomMessage, WatchRoomSnapshot,
  WatchRoomStatus, WatchRoomSummary,
} from "@/lib/types";
import { db } from "@/server/db";
import { notifyWatchRoom } from "@/server/lounge-events";
import { getAllMedia } from "@/server/media/queries";

type RoomRow = {
  id: string;
  host_user_id: string;
  host_display_name: string;
  media_id: string;
  status: WatchRoomStatus;
  control_mode: WatchRoomControlMode;
  position: number;
  duration: number | null;
  state_updated_at: number;
  play_at: number | null;
  created_at: number;
  ended_at: number | null;
  member_count: number;
  invited_count: number;
  joined: number;
  ready: number;
};

type MemberRow = {
  user_id: string;
  display_name: string;
  ready: number;
  playback_state: WatchPresenceState;
  last_position: number;
  last_seen_at: number;
};

type MessageRow = {
  id: string;
  user_id: string;
  display_name: string;
  kind: "message" | "reaction";
  body: string;
  created_at: number;
};

export class LoungeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const activeRoomSelect = `
  SELECT r.*, host.display_name AS host_display_name,
    (SELECT COUNT(*) FROM watch_room_members members WHERE members.room_id = r.id) AS member_count,
    (SELECT COUNT(*) FROM watch_room_invites invites WHERE invites.room_id = r.id) AS invited_count,
    EXISTS(SELECT 1 FROM watch_room_members own_member WHERE own_member.room_id = r.id AND own_member.user_id = ?) AS joined,
    COALESCE((SELECT own_member.ready FROM watch_room_members own_member WHERE own_member.room_id = r.id AND own_member.user_id = ?), 0) AS ready
  FROM watch_rooms r
  JOIN users host ON host.id = r.host_user_id
`;

function accessibleRoomRow(userId: string, roomId: string) {
  return db.prepare(`${activeRoomSelect}
    WHERE r.id = ? AND (
      r.host_user_id = ? OR
      EXISTS(SELECT 1 FROM watch_room_invites access_invite WHERE access_invite.room_id = r.id AND access_invite.user_id = ?)
    )
  `).get(userId, userId, roomId, userId, userId) as RoomRow | undefined;
}

function roomMedia(userId: string, mediaId: string) {
  return getAllMedia(userId).find((item) => item.id === mediaId) ?? null;
}

function toSummary(userId: string, row: RoomRow, media: MediaItem): WatchRoomSummary {
  const now = Date.now();
  return {
    id: row.id,
    media,
    hostUserId: row.host_user_id,
    hostDisplayName: row.host_display_name,
    status: row.status,
    controlMode: row.control_mode,
    position: roomPlaybackPosition({
      status: row.status,
      position: row.position,
      stateUpdatedAt: row.state_updated_at,
      playAt: row.play_at,
      now,
      duration: row.duration,
    }),
    duration: row.duration,
    stateUpdatedAt: now,
    playAt: row.play_at && row.play_at > now ? row.play_at : null,
    createdAt: row.created_at,
    memberCount: row.member_count,
    invitedCount: row.invited_count,
    isHost: row.host_user_id === userId,
    joined: Boolean(row.joined),
    ready: Boolean(row.ready),
  };
}

export function getLoungeFeed(user: SafeUser): LoungeFeed {
  const now = Date.now();
  const people = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.role,
      EXISTS(SELECT 1 FROM watch_room_members member WHERE member.user_id = u.id AND member.last_seen_at > ?) AS online
    FROM users u ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, u.display_name COLLATE NOCASE
  `).all(now - 30_000, user.id) as Array<{
    id: string; username: string; display_name: string; role: "admin" | "viewer"; online: number;
  }>;

  const roomRows = db.prepare(`${activeRoomSelect}
    WHERE r.ended_at IS NULL AND (
      r.host_user_id = ? OR
      EXISTS(SELECT 1 FROM watch_room_invites access_invite WHERE access_invite.room_id = r.id AND access_invite.user_id = ?)
    )
    ORDER BY r.created_at DESC
  `).all(user.id, user.id, user.id, user.id) as RoomRow[];
  const media = getAllMedia(user.id);
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const rooms = roomRows.flatMap((row) => {
    const item = mediaById.get(row.media_id);
    return item ? [toSummary(user.id, row, item)] : [];
  });

  return {
    people: people.map((person): LoungePerson => ({
      id: person.id,
      username: person.username,
      displayName: person.display_name,
      role: person.role,
      online: Boolean(person.online),
    })),
    rooms,
    watchableMedia: media.filter((item) => item.kind !== "music"),
  };
}

export function createWatchRoom(user: SafeUser, input: {
  mediaId: string;
  invitedUserIds: string[];
  controlMode: WatchRoomControlMode;
}) {
  const media = roomMedia(user.id, input.mediaId);
  if (!media || media.kind === "music") throw new LoungeError("Choose a movie or episode");
  if (!(["host", "everyone"] as string[]).includes(input.controlMode)) throw new LoungeError("Choose who can control playback");
  const invitedIds = [...new Set(input.invitedUserIds)].filter((id) => id !== user.id).slice(0, 50);
  const validUsers = invitedIds.length
    ? db.prepare(`SELECT id FROM users WHERE id IN (${invitedIds.map(() => "?").join(",")})`).all(...invitedIds) as Array<{ id: string }>
    : [];
  if (validUsers.length !== invitedIds.length) throw new LoungeError("One of those Vanta profiles no longer exists");

  const roomId = randomUUID();
  const now = Date.now();
  db.transaction(() => {
    db.prepare(`
      INSERT INTO watch_rooms (id, host_user_id, media_id, status, control_mode, position, state_updated_at, created_at)
      VALUES (?, ?, ?, 'waiting', ?, 0, ?, ?)
    `).run(roomId, user.id, media.id, input.controlMode, now, now);
    const invite = db.prepare("INSERT INTO watch_room_invites (room_id, user_id, invited_at) VALUES (?, ?, ?)");
    invite.run(roomId, user.id, now);
    for (const invited of validUsers) invite.run(roomId, invited.id, now);
    db.prepare(`
      INSERT INTO watch_room_members (room_id, user_id, ready, playback_state, last_position, last_seen_at, joined_at)
      VALUES (?, ?, 0, 'joining', 0, ?, ?)
    `).run(roomId, user.id, now, now);
  })();
  return roomId;
}

export function getWatchRoom(user: SafeUser, roomId: string): WatchRoomSnapshot | null {
  const row = accessibleRoomRow(user.id, roomId);
  if (!row) return null;
  const media = roomMedia(user.id, row.media_id);
  if (!media) return null;
  const now = Date.now();
  const members = db.prepare(`
    SELECT member.user_id, u.display_name, member.ready, member.playback_state, member.last_position, member.last_seen_at
    FROM watch_room_members member JOIN users u ON u.id = member.user_id
    WHERE member.room_id = ? ORDER BY member.joined_at
  `).all(roomId) as MemberRow[];
  const messages = row.joined ? db.prepare(`
    SELECT message.id, message.user_id, u.display_name, message.kind, message.body, message.created_at
    FROM watch_room_messages message JOIN users u ON u.id = message.user_id
    WHERE message.room_id = ? ORDER BY message.created_at DESC LIMIT 100
  `).all(roomId).reverse() as MessageRow[] : [];

  return {
    ...toSummary(user.id, row, media),
    serverNow: now,
    members: members.map((member): WatchRoomMember => ({
      userId: member.user_id,
      displayName: member.display_name,
      isHost: member.user_id === row.host_user_id,
      ready: Boolean(member.ready),
      online: member.last_seen_at > now - 30_000,
      playbackState: member.playback_state,
      position: member.last_position,
    })),
    messages: messages.map((message): WatchRoomMessage => ({
      id: message.id,
      userId: message.user_id,
      displayName: message.display_name,
      kind: message.kind,
      body: message.body,
      createdAt: message.created_at,
    })),
  };
}

function joinedRoom(user: SafeUser, roomId: string) {
  const row = accessibleRoomRow(user.id, roomId);
  if (!row) throw new LoungeError("Watch room not found", 404);
  if (!row.joined) throw new LoungeError("Join this room first", 403);
  return row;
}

export function joinWatchRoom(user: SafeUser, roomId: string) {
  const row = accessibleRoomRow(user.id, roomId);
  if (!row) throw new LoungeError("Watch room not found", 404);
  if (row.status === "ended") throw new LoungeError("This watch room has ended", 409);
  const now = Date.now();
  db.prepare(`
    INSERT INTO watch_room_members (room_id, user_id, ready, playback_state, last_position, last_seen_at, joined_at)
    VALUES (?, ?, 0, 'joining', ?, ?, ?)
    ON CONFLICT(room_id, user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at
  `).run(roomId, user.id, row.position, now, now);
  notifyWatchRoom(roomId);
}

export function setWatchRoomReady(user: SafeUser, roomId: string, ready: boolean) {
  joinedRoom(user, roomId);
  db.prepare(`
    UPDATE watch_room_members SET ready = ?, playback_state = ?, last_seen_at = ?
    WHERE room_id = ? AND user_id = ?
  `).run(ready ? 1 : 0, ready ? "ready" : "joining", Date.now(), roomId, user.id);
  notifyWatchRoom(roomId);
}

export function updateWatchRoomPresence(user: SafeUser, roomId: string, state: WatchPresenceState, position: number) {
  joinedRoom(user, roomId);
  const safePosition = Number.isFinite(position) ? Math.max(0, Math.min(position, 7 * 24 * 60 * 60)) : 0;
  db.prepare(`
    UPDATE watch_room_members SET playback_state = ?, last_position = ?, last_seen_at = ?
    WHERE room_id = ? AND user_id = ?
  `).run(state, safePosition, Date.now(), roomId, user.id);
}

export function controlWatchRoom(user: SafeUser, roomId: string, input: {
  action: "start" | "play" | "pause" | "seek" | "end";
  position: number;
  duration: number | null;
}) {
  const room = joinedRoom(user, roomId);
  const isHost = room.host_user_id === user.id;
  if ((input.action === "start" || input.action === "end") && !isHost) throw new LoungeError("Only the host can do that", 403);
  if (!isHost && room.control_mode !== "everyone") throw new LoungeError("The host controls this room", 403);
  if (room.status === "ended") throw new LoungeError("This watch room has ended", 409);
  const now = Date.now();
  const position = Number.isFinite(input.position) ? Math.max(0, Math.min(input.position, 7 * 24 * 60 * 60)) : 0;
  const duration = input.duration && Number.isFinite(input.duration) ? Math.max(0, Math.min(input.duration, 7 * 24 * 60 * 60)) : null;
  if (input.action === "end") {
    db.prepare("UPDATE watch_rooms SET status = 'ended', position = ?, duration = ?, state_updated_at = ?, play_at = NULL, ended_at = ? WHERE id = ?")
      .run(position, duration, now, now, roomId);
  } else {
    const status: WatchRoomStatus = input.action === "pause"
      ? "paused"
      : input.action === "seek" && room.status !== "playing"
        ? "paused"
        : "playing";
    const playAt = input.action === "start" ? now + 3_000 : status === "playing" ? now + 250 : null;
    db.prepare("UPDATE watch_rooms SET status = ?, position = ?, duration = ?, state_updated_at = ?, play_at = ? WHERE id = ?")
      .run(status, position, duration, playAt ?? now, playAt, roomId);
  }
  notifyWatchRoom(roomId);
}

export function addWatchRoomMessage(user: SafeUser, roomId: string, kind: "message" | "reaction", body: unknown) {
  joinedRoom(user, roomId);
  const cleanBody = kind === "reaction"
    ? isRoomReaction(body) ? body : null
    : cleanRoomMessage(body);
  if (!cleanBody) throw new LoungeError("Choose one of Vanta's quick reactions");
  const id = randomUUID();
  const now = Date.now();
  db.transaction(() => {
    db.prepare("INSERT INTO watch_room_messages (id, room_id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, roomId, user.id, kind, cleanBody, now);
    db.prepare(`
      DELETE FROM watch_room_messages WHERE room_id = ? AND id NOT IN (
        SELECT id FROM watch_room_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 500
      )
    `).run(roomId, roomId);
  })();
  notifyWatchRoom(roomId);
  return id;
}
