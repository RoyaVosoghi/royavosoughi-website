import "server-only";

import type { FunctionDeclaration } from "@google/genai";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const checkRegistrationStatusDeclaration: FunctionDeclaration = {
  name: "check_registration_status",
  description:
    "Look up whether a visitor is registered for a webinar or online class, by email. Use this when they ask about their registration status.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      email: { type: "string", description: "The visitor's email address" },
      event_type: {
        type: "string",
        enum: ["webinar", "online_class"],
        description: "Optionally narrow the lookup to one event type",
      },
    },
    required: ["email"],
  },
};

const RegistrationArgsSchema = z.object({
  email: z.email().max(200),
  event_type: z.enum(["webinar", "online_class"]).optional(),
});

export async function executeCheckRegistrationStatus(
  args: unknown,
): Promise<Record<string, unknown>> {
  const parsed = RegistrationArgsSchema.safeParse(args);
  if (!parsed.success) {
    return { error: "invalid_arguments" };
  }
  const { email, event_type } = parsed.data;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "not_configured" };

  let query = supabase
    .from("registrations")
    .select("event_type, status, created_at")
    .eq("email", email)
    .order("created_at", { ascending: false });

  if (event_type) query = query.eq("event_type", event_type);

  const { data, error } = await query;

  if (error) {
    console.error("[tool:check_registration_status] query failed:", error.message);
    return { error: "lookup_failed" };
  }

  if (!data || data.length === 0) {
    return { found: false };
  }

  return { found: true, registrations: data };
}
