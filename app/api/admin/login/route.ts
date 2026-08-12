import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isAdminConfigured,
  verifyAdminCredentials,
} from "@/lib/admin/auth";
import { isLoginLocked, recordFailedLogin } from "@/lib/admin/login-rate-limit";
import { getClientIp } from "@/lib/http";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

const LoginSchema = z.object({
  email: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  if (!isAdminConfigured() || !isSupabaseServiceConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const ip = getClientIp(request);

  if (await isLoginLocked(parsed.data.email, ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const admin = await verifyAdminCredentials(parsed.data.email, parsed.data.password);
  if (!admin) {
    await recordFailedLogin(parsed.data.email, ip);
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(admin.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // "/" not "/admin": app/api/admin/* route handlers (settings, handoffs)
    // need this cookie too, and they don't live under the /admin path prefix.
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
