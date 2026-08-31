import "server-only";

import { logAiUsage } from "@/lib/admin/queries";

import { getOpenRouterClient, isOpenRouterConfigured } from "./providers/openrouter";
import { estimateCostUsd } from "./model-catalog";

/** Same fixed cheap model as lead-score.ts / contact-summary.ts / summarize.ts. */
const NEXT_ACTION_MODEL = "google/gemini-2.5-flash";

const NEXT_ACTION_INSTRUCTION = `You advise a solo AI-engineering consultant/coach on what to do next with one of their sales deals. Given the deal's details, its current pipeline stage, recent activity log, and (if available) an AI summary of the contact, suggest ONE concrete next action they should take. Be specific and actionable (e.g. "Send a follow-up email referencing their Q3 budget mention" rather than "follow up"). One or two sentences, plain prose, no markdown.`;

export interface DealNextActionInput {
  title: string;
  stageName: string;
  amountCents: number;
  currency: string;
  contactName: string;
  contactSummary: string | null;
  recentActivities: Array<{ type: string; subject: string; createdAt: string; completedAt: string | null }>;
}

function formatInput(input: DealNextActionInput): string {
  const lines = [
    `Deal: ${input.title}`,
    `Stage: ${input.stageName}`,
    `Amount: ${(input.amountCents / 100).toFixed(2)} ${input.currency}`,
    `Contact: ${input.contactName}`,
  ];
  if (input.contactSummary) lines.push(`Contact summary: ${input.contactSummary}`);
  if (input.recentActivities.length) {
    lines.push("", "Recent activity:");
    for (const a of input.recentActivities) {
      lines.push(`- [${a.type}] ${a.subject} (${a.completedAt ? "completed" : "open"}, ${a.createdAt})`);
    }
  } else {
    lines.push("", "No activity logged yet.");
  }
  return lines.join("\n");
}

/** Fails soft — returns null on any error, same convention as the other two lib/ai internal-task calls. */
export async function suggestDealNextAction(input: DealNextActionInput): Promise<string | null> {
  const client = getOpenRouterClient();
  if (!client || !isOpenRouterConfigured()) return null;

  try {
    const response = await client.chat.completions.create({
      model: NEXT_ACTION_MODEL,
      messages: [
        { role: "system", content: NEXT_ACTION_INSTRUCTION },
        { role: "user", content: formatInput(input) },
      ],
    });

    const suggestion = response.choices[0]?.message?.content?.trim();
    if (!suggestion) return null;

    const tokensIn = response.usage?.prompt_tokens ?? null;
    const tokensOut = response.usage?.completion_tokens ?? null;
    const costUsd =
      tokensIn !== null && tokensOut !== null ? estimateCostUsd(NEXT_ACTION_MODEL, tokensIn, tokensOut) : null;
    await logAiUsage("deal_next_action", tokensIn, tokensOut, costUsd);

    return suggestion;
  } catch (err) {
    console.error("[deal-next-action] suggestion failed:", err);
    return null;
  }
}
