import "server-only";

import { z } from "zod";

import { logAiUsage } from "@/lib/admin/queries";

import { getOpenRouterClient, isOpenRouterConfigured } from "./providers/openrouter";
import { estimateCostUsd } from "./model-catalog";
import type { ChatMessage } from "./types";

/** A fixed, cheap model for this internal-only call — same choice as summarize.ts, never needs to match whatever's configured for user-facing replies in model_config. */
const SCORE_MODEL = "google/gemini-2.5-flash";

const SCORE_INSTRUCTION = `You score inbound sales leads for a solo AI-engineering consultant/coach. Given a lead's submitted details and, if available, their chat transcript with the site's assistant, score how promising this lead is on a 0-100 scale (0 = spam/irrelevant, 100 = ready to buy now) and give a one-sentence reason. Weigh: how specific and relevant their stated interest is, any buying signals or urgency in the transcript, and how genuine the submission looks. Respond with ONLY a JSON object, no markdown, no code fences: {"score": <integer 0-100>, "reasoning": "<one sentence>"}`;

const ScoreResultSchema = z.object({
  score: z.number().min(0).max(100),
  reasoning: z.string().min(1).max(500),
});

export interface LeadScoreInput {
  name: string;
  email: string;
  interest: string | null;
  source: string | null;
  companyName: string | null;
  transcript?: ChatMessage[];
}

export interface LeadScoreResult {
  score: number;
  reasoning: string;
}

function formatInput(input: LeadScoreInput): string {
  const lines = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Interest: ${input.interest ?? "(none given)"}`,
    `Source: ${input.source ?? "unknown"}`,
    `Company: ${input.companyName ?? "(none given)"}`,
  ];
  if (input.transcript?.length) {
    lines.push("", "Chat transcript:");
    for (const m of input.transcript) {
      lines.push(`${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`);
    }
  }
  return lines.join("\n");
}

/** Fails soft — returns null on any error (missing config, malformed JSON, upstream failure), same convention as summarize.ts. Callers must treat null as "couldn't score, leave the lead unscored" rather than throwing. */
export async function scoreLead(input: LeadScoreInput): Promise<LeadScoreResult | null> {
  const client = getOpenRouterClient();
  if (!client || !isOpenRouterConfigured()) return null;

  try {
    const response = await client.chat.completions.create({
      model: SCORE_MODEL,
      messages: [
        { role: "system", content: SCORE_INSTRUCTION },
        { role: "user", content: formatInput(input) },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const parsed = ScoreResultSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error("[lead-score] model returned unparseable JSON:", raw);
      return null;
    }

    const tokensIn = response.usage?.prompt_tokens ?? null;
    const tokensOut = response.usage?.completion_tokens ?? null;
    const costUsd = tokensIn !== null && tokensOut !== null ? estimateCostUsd(SCORE_MODEL, tokensIn, tokensOut) : null;
    await logAiUsage("lead_score", tokensIn, tokensOut, costUsd);

    return { score: Math.round(parsed.data.score), reasoning: parsed.data.reasoning };
  } catch (err) {
    console.error("[lead-score] scoring failed:", err);
    return null;
  }
}
