import "server-only";

import { z } from "zod";

import { logAiUsage, type AiUsagePurpose } from "@/lib/admin/queries";
import type { DocLocale } from "@/lib/crm/format";

import { estimateCostUsd } from "./model-catalog";
import { getOpenRouterClient, isOpenRouterConfigured } from "./providers/openrouter";

/**
 * Writing tasks for the CRM: contract personalisation, contract follow-ups
 * and campaign emails. Same fixed cheap model as lead-score.ts /
 * deal-next-action.ts. Gemini 2.5 Flash spends part of max_tokens on
 * reasoning, so the ceilings here are deliberately generous — a tight cap
 * shows up as truncated JSON or a contract that stops mid-article.
 */
const WRITER_MODEL = "google/gemini-2.5-flash";

export type WriterResult<T> = { ok: true; value: T } | { ok: false; error: "not_configured" | "no_credits" | "failed" };

/** OpenRouter answers 402 when the account balance is empty — worth telling the admin precisely, "try again" won't help. */
const failure = (err: unknown): { ok: false; error: "no_credits" | "failed" } => ({
  ok: false,
  error: err && typeof err === "object" && "status" in err && (err as { status: unknown }).status === 402 ? "no_credits" : "failed",
});

const BRAND_VOICE = `Voice: Roya Vosoughi, a solo AI engineer and software developer ("AI engineered for reality"). Direct, practical, warm, calm. No hype words (revolutionary, game-changing, secret, transform). Never promise business results — only the work and how it is done. Never mention any city or country. In Persian, always address the reader formally with «شما».`;

async function complete(purpose: AiUsagePurpose, system: string, user: string, maxTokens: number): Promise<string | null> {
  const client = getOpenRouterClient();
  if (!client) return null;
  const response = await client.chat.completions.create({
    model: WRITER_MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const text = response.choices[0]?.message?.content?.trim() ?? "";
  const tokensIn = response.usage?.prompt_tokens ?? null;
  const tokensOut = response.usage?.completion_tokens ?? null;
  const costUsd = tokensIn !== null && tokensOut !== null ? estimateCostUsd(WRITER_MODEL, tokensIn, tokensOut) : null;
  await logAiUsage(purpose, tokensIn, tokensOut, costUsd);
  return text || null;
}

function stripFences(text: string): string {
  return text.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
}

/** Structured output: parse + zod-validate, one retry with the validation error fed back. */
async function completeJson<T>(purpose: AiUsagePurpose, schema: z.ZodType<T>, system: string, user: string, maxTokens: number): Promise<T | null> {
  let prompt = user;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await complete(purpose, system, prompt, maxTokens);
    if (!raw) continue;
    try {
      const parsed = schema.safeParse(JSON.parse(stripFences(raw)));
      if (parsed.success) return parsed.data;
      prompt = `${user}\n\nYour previous answer did not match the required JSON shape (${parsed.error.issues[0]?.message ?? "invalid"}). Reply again with ONLY the JSON object.`;
    } catch {
      prompt = `${user}\n\nYour previous answer was not valid JSON. Reply again with ONLY the JSON object, no markdown.`;
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// Contract rewrite
// -----------------------------------------------------------------------------

export interface ContractRewriteInput {
  locale: DocLocale;
  bodyMd: string;
  clientName: string;
  clientCompany: string | null;
  leadChallenge: string | null;
  customerInsight: string | null;
  dealTitle: string | null;
}

export async function rewriteContract(input: ContractRewriteInput): Promise<WriterResult<string>> {
  if (!isOpenRouterConfigured()) return { ok: false, error: "not_configured" };
  const system = `You personalise a service contract for a specific client. ${BRAND_VOICE}

Rules:
- Return the FULL contract as Markdown, in ${input.locale === "fa" ? "Persian (Farsi)" : "English"}, and nothing else — no preamble, no code fences.
- Keep every "## " article heading, in the same order; do not add or remove articles and do not number them (numbering is automatic).
- Keep all amounts, dates, percentages, names, emails, notice periods and any [placeholder in brackets] exactly as written.
- Keep the clause that the consultant's obligation is one of effort, not of result.
- Only tailor wording: make the subject, scope and deliverables speak to this client's situation and challenge, concretely and briefly.`;
  const user = [
    `Client: ${input.clientName}${input.clientCompany ? `, ${input.clientCompany}` : ""}`,
    input.dealTitle ? `Deal: ${input.dealTitle}` : "",
    input.leadChallenge ? `Client's challenge in their own words: ${input.leadChallenge}` : "",
    input.customerInsight ? `What we know about the client: ${input.customerInsight}` : "",
    "",
    "Contract:",
    input.bodyMd,
  ]
    .filter((line) => line !== "")
    .join("\n");

  try {
    const text = await complete("contract_rewrite", system, user, 12000);
    if (!text) return { ok: false, error: "failed" };
    const md = stripFences(text);
    const headingsBefore = (input.bodyMd.match(/^## /gm) ?? []).length;
    const headingsAfter = (md.match(/^## /gm) ?? []).length;
    // A truncated or restructured answer is worse than no answer.
    if (headingsAfter !== headingsBefore) {
      console.error("[crm-writer] rewrite changed article count", headingsBefore, "→", headingsAfter);
      return { ok: false, error: "failed" };
    }
    return { ok: true, value: md };
  } catch (err) {
    console.error("[crm-writer] rewriteContract failed:", err);
    return failure(err);
  }
}

// -----------------------------------------------------------------------------
// Contract follow-up
// -----------------------------------------------------------------------------

export async function contractFollowUp(input: {
  locale: DocLocale;
  clientName: string;
  title: string;
  daysWaiting: number;
  viewed: boolean;
  url: string;
}): Promise<WriterResult<string>> {
  if (!isOpenRouterConfigured()) return { ok: false, error: "not_configured" };
  const system = `You write a short, polite follow-up message about a contract the client has not accepted yet. ${BRAND_VOICE}
Write in ${input.locale === "fa" ? "Persian (Farsi)" : "English"}. 60–110 words, plain text, no subject line, no markdown. Mention gently how long it has been, offer to answer questions or adjust anything, include the link exactly once, and sign off as Roya. No pressure, no fake urgency.`;
  const user = [
    `Client first name: ${input.clientName.split(/\s+/)[0]}`,
    `Contract: ${input.title}`,
    `Days since it was sent: ${input.daysWaiting}`,
    `Client has opened it: ${input.viewed ? "yes" : "not yet"}`,
    `Link: ${input.url}`,
  ].join("\n");
  try {
    const text = await complete("contract_followup", system, user, 2500);
    return text ? { ok: true, value: stripFences(text) } : { ok: false, error: "failed" };
  } catch (err) {
    console.error("[crm-writer] contractFollowUp failed:", err);
    return failure(err);
  }
}

// -----------------------------------------------------------------------------
// Campaign email
// -----------------------------------------------------------------------------

const CampaignEmailSchema = z.object({
  subject: z.string().min(3).max(140),
  body: z.string().min(20).max(2000),
});

export async function writeCampaignEmail(input: {
  locale: DocLocale;
  goal: string;
  segmentLabel: string;
  toName: string;
  context: Record<string, unknown>;
}): Promise<WriterResult<{ subject: string; body: string }>> {
  if (!isOpenRouterConfigured()) return { ok: false, error: "not_configured" };
  const system = `You write ONE personal email from Roya to one specific person. ${BRAND_VOICE}
Write in ${input.locale === "fa" ? "Persian (Farsi)" : "English"}.
- Refer concretely to THIS person's own situation or challenge from the context — it must not read like a template.
- At most 120 words in the body. No sales language, no exclamation-mark enthusiasm, no invented facts.
- End by offering a free 30-minute call (a button for booking is added below the email automatically — do not include a URL).
- Greet them by first name; sign off as Roya. Separate paragraphs with a blank line.
Respond with ONLY a JSON object, no markdown: {"subject": "...", "body": "..."}`;
  const user = [
    `Campaign goal: ${input.goal}`,
    `Audience segment: ${input.segmentLabel}`,
    `Recipient name: ${input.toName}`,
    `What we know about them (JSON): ${JSON.stringify(input.context)}`,
  ].join("\n");
  try {
    const value = await completeJson("campaign_email", CampaignEmailSchema, system, user, 2500);
    return value ? { ok: true, value } : { ok: false, error: "failed" };
  } catch (err) {
    console.error("[crm-writer] writeCampaignEmail failed:", err);
    return failure(err);
  }
}
