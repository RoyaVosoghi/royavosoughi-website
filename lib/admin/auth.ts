import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Real per-admin auth: admin_users.password_hash, checked with bcrypt.
 * ADMIN_PASSWORD stays as a break-glass bootstrap — it only works for a
 * seeded 'owner' row that hasn't set a password_hash yet (see
 * verifyAdminCredentials), so Roya can never get locked out even before her
 * first login, but the shared secret stops being a live credential the
 * moment she sets a real password from /admin/team.
 *
 * Session cookie now signs {adminUserId, expiresAt} instead of a bare
 * boolean — same HMAC-over-a-fixed-payload pattern as before, just a JSON
 * payload instead of a single number.
 */

export type AdminRole = "owner" | "editor" | "operator" | "viewer";

const ROLE_RANK: Record<AdminRole, number> = { viewer: 1, operator: 2, editor: 3, owner: 4 };

export function roleAtLeast(role: AdminRole, min: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export interface AdminSession {
  adminUserId: string;
  expiresAt: number;
}

export interface CurrentAdmin {
  id: string;
  email: string;
  role: AdminRole;
}

export const ADMIN_SESSION_COOKIE = "rv_admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const ADMIN_SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_SESSION_SECRET);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sign(payload: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("admin_not_configured");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionToken(adminUserId: string): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ adminUserId, expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): AdminSession | null {
  if (!token || !isAdminConfigured()) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  if (!timingSafeStringEqual(signature, expected)) return null;

  let parsed: AdminSession;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed.adminUserId || !Number.isFinite(parsed.expiresAt)) return null;
  if (Date.now() > parsed.expiresAt) return null;

  return parsed;
}

/** For Route Handlers under app/api/admin/* — the (protected) layout's redirect only covers app/admin/* pages, not API routes, so those need this explicit check. */
export async function hasValidAdminSession(): Promise<boolean> {
  return (await getCurrentAdmin()) !== null;
}

const adminCache = new Map<string, { value: CurrentAdmin | null; expiresAt: number }>();
const ADMIN_CACHE_TTL_MS = 30_000;

/** Reads the session cookie, resolves it to the admin_users row (role included). Null if not logged in, or if the referenced row was deleted. */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return null;

  const hit = adminCache.get(session.adminUserId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("admin_users")
    .select("id, email, role")
    .eq("id", session.adminUserId)
    .maybeSingle();

  const value: CurrentAdmin | null = data
    ? { id: data.id, email: data.email, role: data.role as AdminRole }
    : null;
  adminCache.set(session.adminUserId, { value, expiresAt: Date.now() + ADMIN_CACHE_TTL_MS });
  return value;
}

/** Route handlers call this instead of hand-checking hasValidAdminSession + role — returns the admin on success, or a ready-to-return 401/403 NextResponse-shaped error on failure. */
export async function requireRole(min: AdminRole): Promise<
  { ok: true; admin: CurrentAdmin } | { ok: false; status: 401 | 403 }
> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, status: 401 };
  if (!roleAtLeast(admin.role, min)) return { ok: false, status: 403 };
  return { ok: true, admin };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * email+password → the matching admin_users row, or null. Two paths:
 * 1. Normal: row has password_hash set, bcrypt.compare against it.
 * 2. Bootstrap: row has NO password_hash yet (fresh seed) and is an
 *    'owner' — falls back to the shared ADMIN_PASSWORD env var so the very
 *    first login (before anyone has set a personal password from
 *    /admin/team) always works. Once that owner sets a password, this path
 *    stops applying to their row.
 */
export async function verifyAdminCredentials(email: string, password: string): Promise<CurrentAdmin | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("admin_users")
    .select("id, email, role, password_hash")
    .ilike("email", email.trim())
    .maybeSingle();

  if (!data) return null;

  if (data.password_hash) {
    const valid = await bcrypt.compare(password, data.password_hash);
    return valid ? { id: data.id, email: data.email, role: data.role as AdminRole } : null;
  }

  const bootstrapSecret = process.env.ADMIN_PASSWORD;
  if (data.role === "owner" && bootstrapSecret && timingSafeStringEqual(password, bootstrapSecret)) {
    return { id: data.id, email: data.email, role: data.role as AdminRole };
  }

  return null;
}
