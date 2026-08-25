import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { sendContactNotification } from "@/lib/resend";

const ContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  businessStage: z
    .enum(["idea", "early", "growing", "established"])
    .optional()
    .or(z.literal("")),
  preferredTime: z
    .enum(["morning", "afternoon", "evening"])
    .optional()
    .or(z.literal("")),
  message: z.string().trim().min(10).max(4000),
  locale: z.enum(["en", "fa"]).default("en"),
  subject: z.string().trim().max(80).optional().or(z.literal("")),
  /**
   * Honeypot: hidden from humans, irresistible to naive bots.
   * Accepts ANY string on purpose — it is checked in the handler, which
   * answers 200 so a bot never learns which field gave it away.
   */
  website: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ContactSchema.safeParse(body);
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

  const supabase = getSupabaseClient()!;
  const { error } = await supabase.from("contact_messages").insert({
    name: data.name,
    email: data.email,
    company: data.company || null,
    business_stage: data.businessStage || null,
    preferred_time: data.preferredTime || null,
    message: data.message,
    locale: data.locale,
    source: data.subject || "website",
  });

  if (error) {
    // Log server-side; never leak database detail to the client.
    console.error("[contact] insert failed:", error.message);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  await sendContactNotification(data);

  return NextResponse.json({ ok: true });
}
