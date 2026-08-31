import "server-only";

import { logAiUsage } from "@/lib/admin/queries";

import { getOpenRouterClient, isOpenRouterConfigured } from "./providers/openrouter";
import { estimateCostUsd } from "./model-catalog";
import type { ChatMessage } from "./types";

/** Same fixed cheap model as lead-score.ts / summarize.ts — internal-only, never needs to match the user-facing model_config. */
const SUMMARY_MODEL = "google/gemini-2.5-flash";

const SUMMARY_INSTRUCTION = `You write a short internal briefing for a solo AI-engineering consultant/coach about one of their contacts, based on that contact's chat history with the site's assistant. Focus on: what they need or are trying to accomplish, any objections or hesitations they raised, and any buying signals (urgency, budget mentions, explicit interest in booking/buying). Write plain prose, 4-6 sentences, no markdown, no headers. If the transcripts don't contain enough signal for one of those three things, just omit it rather than guessing.`;

function formatTranscripts(conversations: Array<{ channel: string; messages: ChatMessage[] }>): string {
  return conversations
    .map(
      (c, i) =>
        `Conversation ${i + 1} (${c.channel}):\n${c.messages.map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`).join("\n")}`,
    )
    .join("\n\n");
}

/** Fails soft — returns null on any error, same convention as summarize.ts/lead-score.ts. */
export async function summarizeContact(
  contactName: string,
  conversations: Array<{ channel: string; messages: ChatMessage[] }>,
): Promise<string | null> {
  const client = getOpenRouterClient();
  if (!client || !isOpenRouterConfigured() || conversations.length === 0) return null;

  try {
    const response = await client.chat.completions.create({
      model: SUMMARY_MODEL,
      messages: [
        { role: "system", content: SUMMARY_INSTRUCTION },
        { role: "user", content: `Contact: ${contactName}\n\n${formatTranscripts(conversations)}` },
      ],
    });

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) return null;

    const tokensIn = response.usage?.prompt_tokens ?? null;
    const tokensOut = response.usage?.completion_tokens ?? null;
    const costUsd = tokensIn !== null && tokensOut !== null ? estimateCostUsd(SUMMARY_MODEL, tokensIn, tokensOut) : null;
    await logAiUsage("contact_summary", tokensIn, tokensOut, costUsd);

    return summary;
  } catch (err) {
    console.error("[contact-summary] summarization failed:", err);
    return null;
  }
}
