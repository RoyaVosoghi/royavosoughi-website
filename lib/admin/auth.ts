import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Solo-owner admin auth: one shared password (env var), no user table.
 * Session is a signed, expiring token in an httpOnly cookie — not a JWT
 * library, because the only claim that matters is "expires at", and HMAC
 * over that one value is enough to make the token unforgeable.
 */

export const ADMIN_SESSION_COOKIE = "rv_admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Length must match for timingSafeEqual; comparing against a fixed-size
  // hash of both sides first would be more robust, but a length check here
  // leaks only the password's length, not its content — an acceptable
  // trade-off for a single-operator admin login.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return timingSafeStringEqual(candidate, expected);
}

function sign(payload: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("admin_not_configured");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !isAdminConfigured()) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }

  if (!timingSafeStringEqual(signature, expected)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return true;
}

export const ADMIN_SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
