import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SafeUser } from "@/lib/types";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/server/config";
import { db, pruneExpiredSessions } from "@/server/db";

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters")
    .max(32, "Use no more than 32 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores"),
  password: z.string().min(10, "Use at least 10 characters").max(128),
});

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "viewer";
};

type UserWithPasswordRow = UserRow & { password_hash: string };

function safeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hasUsers() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get() as {
    count: number;
  };
  return row.count > 0;
}

export function getUsers(): SafeUser[] {
  const rows = db.prepare(
    "SELECT id, username, display_name, role FROM users ORDER BY created_at ASC",
  ).all() as UserRow[];
  return rows.map(safeUser);
}

export async function createViewer(input: unknown) {
  const parsed = credentialsSchema.extend({
    displayName: z.string().trim().min(1).max(50),
  }).safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }
  try {
    db.prepare(
      `INSERT INTO users (id, username, display_name, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, 'viewer', ?)`,
    ).run(
      randomUUID(),
      parsed.data.username,
      parsed.data.displayName,
      await hash(parsed.data.password, 12),
      Date.now(),
    );
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error && error.message.includes("UNIQUE constraint")
        ? "That username is already in use"
        : "Could not create the viewer",
    };
  }
}

export function deleteViewer(id: string) {
  db.prepare("DELETE FROM users WHERE id = ? AND role = 'viewer'").run(id);
}

export async function createInitialAdmin(input: unknown) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  if (hasUsers()) {
    return { ok: false as const, error: "Vanta has already been set up" };
  }

  const now = Date.now();
  const userId = randomUUID();
  const passwordHash = await hash(parsed.data.password, 12);

  try {
    db.transaction(() => {
      if (hasUsers()) throw new Error("Vanta has already been set up");
      db.prepare(
        `INSERT INTO users (id, username, display_name, password_hash, role, created_at)
         VALUES (?, ?, ?, ?, 'admin', ?)`,
      ).run(userId, parsed.data.username, parsed.data.username, passwordHash, now);
    })();
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not create the administrator",
    };
  }

  await createSession(userId);
  return { ok: true as const };
}

export async function login(input: unknown) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Check your username and password" };
  }

  const row = db
    .prepare(
      `SELECT id, username, display_name, role, password_hash
       FROM users WHERE username = ?`,
    )
    .get(parsed.data.username) as UserWithPasswordRow | undefined;

  if (!row || !(await compare(parsed.data.password, row.password_hash))) {
    return { ok: false as const, error: "Incorrect username or password" };
  }

  await createSession(row.id);
  return { ok: true as const, user: safeUser(row) };
}

async function createSession(userId: string) {
  pruneExpiredSessions();
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(tokenHash(token), userId, expiresAt, now);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.VANTA_SECURE_COOKIES === "true",
    path: "/",
    expires: new Date(expiresAt),
    priority: "high",
  });
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SafeUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.role, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(tokenHash(token)) as (UserRow & { expires_at: number }) | undefined;

  if (!row || row.expires_at <= Date.now()) {
    if (row) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
    return null;
  }

  return safeUser(row);
}

export async function requirePageUser() {
  const user = await getSessionUser();
  if (!user) redirect(hasUsers() ? "/login" : "/setup");
  return user;
}

export async function requirePageAdmin() {
  const user = await requirePageUser();
  if (user.role !== "admin") redirect("/browse");
  return user;
}

export async function requireApiUser() {
  return getSessionUser();
}

export async function requireApiAdmin() {
  const user = await getSessionUser();
  return user?.role === "admin" ? user : null;
}
