import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { sendServiceRequestNotification } from "@/lib/resend";
import { serviceKeys } from "@/lib/service-options";

const ServiceRequestSchema = z.object({
  service: z.enum(serviceKeys),
  name: z.string().trim().min(2).max(120),
  business: z.string().trim().min(1).max(160),
  contact: z.string().trim().min(3).max(120),
  email: z.email().max(200),
  message: z.string().trim().min(5).max(4000),
  /** Honeypot — see app/api/contact/route.ts. */
  website: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ServiceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { website, ...data } = parsed.data;

  // Bot filled the honeypot. Return 200 so it does not learn anything.
  if (website) {
    return NextResponse.json({ ok: true });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  // Anon key: RLS on service_requests allows INSERT and nothing else.
  const supabase = getSupabaseClient()!;
  const { error } = await supabase.from("service_requests").insert(data);

  if (error) {
    console.error("[service-requests] insert failed:", error.message);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  await sendServiceRequestNotification(data);

  return NextResponse.json({ ok: true });
}
