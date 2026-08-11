import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isAdminConfigured,
  verifyAdminPassword,
} from "@/lib/admin/auth";

const LoginSchema = z.object({
  password: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
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

  if (!verifyAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createSessionToken(), {
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
