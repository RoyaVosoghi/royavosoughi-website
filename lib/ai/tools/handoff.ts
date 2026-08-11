import "server-only";

import type { FunctionDeclaration } from "@google/genai";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Locale } from "../types";

export const requestHumanHandoffDeclaration: FunctionDeclaration = {
  name: "request_human_handoff",
  description:
    "Flag this conversation for Roya to follow up on personally — call this when a visitor explicitly asks to talk to a real person, or when their question is genuinely outside what you can help with (out of scope, or you don't have enough grounded information to answer honestly).",
  parametersJsonSchema: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        enum: ["out_of_scope", "user_requested", "other"],
        description: "Why this needs a human: the topic is outside your scope, the visitor asked directly, or something else.",
      },
      note: {
        type: "string",
        description: "A short note for Roya on what the visitor needs, in your own words.",
      },
    },
    required: ["reason"],
  },
};

const HandoffArgsSchema = z.object({
  reason: z.enum(["out_of_scope", "user_requested", "other"]),
  note: z.string().trim().max(1000).optional(),
});

export async function executeRequestHumanHandoff(
  args: unknown,
  ctx: { sessionId: string; locale: Locale },
): Promise<Record<string, unknown>> {
  const parsed = HandoffArgsSchema.safeParse(args);
  if (!parsed.success) {
    return { error: "invalid_arguments" };
  }
  const { reason, note } = parsed.data;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "not_configured" };

  const { error } = await supabase.from("handoff_requests").insert({
    reason,
    note: note || null,
    session_id: ctx.sessionId,
    locale: ctx.locale,
  });

  if (error) {
    console.error("[tool:request_human_handoff] insert failed:", error.message);
    return { error: "storage_failed" };
  }

  return { ok: true };
}
