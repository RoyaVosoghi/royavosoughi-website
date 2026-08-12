import "server-only";

import { buildSystemInstruction } from "./prompt";
import { getActivePromptContent } from "./prompt-versions";
import { retrieveContext, type RetrievedChunk } from "./retrieval";
import { getOpenRouterClient, isOpenRouterConfigured } from "./providers/openrouter";
import { openAiToolDeclarations } from "./tools";
import type { Locale } from "./types";

export interface PlaygroundInput {
  message: string;
  locale: Locale;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  /** Test a draft persona without saving it as the active prompt_versions row. */
  promptOverride?: string;
}

export interface PlaygroundOutput {
  reply: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  retrievedChunks: RetrievedChunk[];
  toolCalls: string[];
}

/**
 * A single-turn, never-persisted version of brain.ts's generation call —
 * reuses the same retrieval/prompt-building so what an admin sees here
 * matches production, but skips memory (no conversation history) and never
 * writes to conversations/messages/leads/handoff_requests. Tool calls are
 * detected and reported, never executed — a test message shouldn't be able
 * to capture a real lead or page a human.
 */
export async function runPlaygroundTurn(input: PlaygroundInput): Promise<PlaygroundOutput> {
  if (!isOpenRouterConfigured()) throw new Error("not_configured");

  const [context, activePrompt] = await Promise.all([
    retrieveContext(input.message, input.locale),
    input.promptOverride !== undefined ? Promise.resolve(input.promptOverride) : getActivePromptContent(input.locale),
  ]);

  const systemInstruction = buildSystemInstruction(input.locale, context, [], { prompt: activePrompt });

  const client = getOpenRouterClient()!;
  const response = await client.chat.completions.create({
    model: input.model,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: input.message },
    ],
    tools: openAiToolDeclarations,
    temperature: input.temperature,
    top_p: input.topP,
    max_tokens: input.maxTokens,
  });

  const message = response.choices[0]?.message;
  const toolCalls = (message?.tool_calls ?? []).filter((c) => c.type === "function").map((c) => c.function.name);

  return {
    reply: message?.content ?? "",
    model: input.model,
    tokensIn: response.usage?.prompt_tokens,
    tokensOut: response.usage?.completion_tokens,
    retrievedChunks: context,
    toolCalls,
  };
}
