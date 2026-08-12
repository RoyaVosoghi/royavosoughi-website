import "server-only";

import { getOpenRouterClient, isOpenRouterConfigured } from "./providers/openrouter";
import type { ChatMessage } from "./types";

const SUMMARIZE_INSTRUCTION = `Summarize the following conversation between a website visitor and an AI assistant, for the assistant's own future reference — not for the visitor to read. Keep only what matters for continuing the conversation naturally: who the visitor is, what they're interested in, decisions or facts already established, and anything they explicitly asked not to repeat. Write it as plain prose, in English regardless of the conversation's language, in 5 sentences or fewer. Do not use markdown.`;

/** A fixed, cheap model for this internal-only call — never needs to match whatever's configured for user-facing replies in model_config. */
const SUMMARIZE_MODEL = "google/gemini-2.5-flash";

function formatTranscript(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`).join("\n");
}

/**
 * A cheap, non-tool OpenRouter call — this never needs function calling, so
 * it's kept separate from brain.ts's tool-calling loop. Folds a previous
 * summary back in (if there was one) so context isn't lost as the
 * conversation grows past multiple summarization passes.
 */
export async function summarizeMessages(
  messages: ChatMessage[],
  previousSummary?: string | null,
): Promise<string> {
  const client = getOpenRouterClient();
  if (!client || !isOpenRouterConfigured() || messages.length === 0) return previousSummary ?? "";

  const priorBlock = previousSummary?.trim()
    ? `Prior summary of even earlier messages:\n${previousSummary.trim()}\n\n`
    : "";

  try {
    const response = await client.chat.completions.create({
      model: SUMMARIZE_MODEL,
      messages: [
        { role: "system", content: SUMMARIZE_INSTRUCTION },
        { role: "user", content: `${priorBlock}Conversation to summarize:\n${formatTranscript(messages)}` },
      ],
    });
    return (response.choices[0]?.message?.content ?? "").trim() || previousSummary || "";
  } catch (err) {
    console.error("[summarize] failed, keeping prior summary:", err);
    return previousSummary ?? "";
  }
}
