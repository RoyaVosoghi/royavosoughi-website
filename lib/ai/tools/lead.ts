import "server-only";

import type { FunctionDeclaration } from "@google/genai";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { addLongTermFact, linkSessionToEmail } from "../memory";
import type { Locale } from "../types";

export const captureLeadDeclaration: FunctionDeclaration = {
  name: "capture_lead",
  description:
    "Record a visitor's name, email, and what they're interested in, so Roya can follow up. Call this once you have at least a name and a valid email — don't ask for information the visitor hasn't offered.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The visitor's name" },
      email: { type: "string", description: "The visitor's email address" },
      interest: {
        type: "string",
        description:
          "What they're interested in, in a few words (e.g. a service, a webinar, a class, general inquiry)",
      },
    },
    required: ["name", "email"],
  },
};

const LeadArgsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.email().max(200),
  interest: z.string().trim().max(400).optional(),
});

export async function executeCaptureLead(
  args: unknown,
  ctx: { sessionId: string; locale: Locale },
): Promise<Record<string, unknown>> {
  const parsed = LeadArgsSchema.safeParse(args);
  if (!parsed.success) {
    return { error: "invalid_arguments" };
  }
  const { name, email, interest } = parsed.data;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "not_configured" };

  const { error } = await supabase.from("leads").insert({
    name,
    email,
    interest: interest || null,
    session_id: ctx.sessionId,
    locale: ctx.locale,
  });

  if (error) {
    console.error("[tool:capture_lead] insert failed:", error.message);
    return { error: "storage_failed" };
  }

  await linkSessionToEmail(ctx.sessionId, email);
  if (interest) {
    await addLongTermFact(email, `Interested in: ${interest}`, ctx.sessionId);
  }

  return { ok: true };
}
