import "server-only";

import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type OpenAI from "openai";

import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";
import { appendMessage, getConversationContext, getLongTermFacts, getOrCreateConversation, upsertUnifiedUser, type Conversation } from "./memory";
import { getModelConfig, resolveScheduledModel, type ModelConfig } from "./model-config";
import { getOpenRouterClient, isOpenRouterConfigured, isRateLimitError } from "./providers/openrouter";
import { buildSystemInstruction } from "./prompt";
import { getActivePromptContent } from "./prompt-versions";
import { checkRateLimit } from "./rate-limit";
import { retrieveContext, type RetrievedChunk } from "./retrieval";
import { dispatchTool, openAiToolDeclarations, type ToolContext } from "./tools";
import { BrainNotConfiguredError, RateLimitError, type BrainTurnInput, type BrainTurnOutput, type Locale } from "./types";

const MAX_TOOL_ITERATIONS = 3;

/** Used by page components to decide whether to render the chat UI at all — true once both the model provider and the DB it persists to are configured. */
export function isBrainConfigured(): boolean {
  return isOpenRouterConfigured() && isSupabaseServiceConfigured();
}

const FALLBACK_REPLY: Record<"en" | "fa", string> = {
  en: "Sorry, I couldn't put together a reply just now. Please try again in a moment.",
  fa: "متاسفم، الان نتوانستم پاسخ بدهم. لطفاً کمی بعد دوباره امتحان کنید.",
};

interface PreparedTurn {
  conversation: Conversation;
  locale: Locale;
  messages: ChatCompletionMessageParam[];
  client: OpenAI;
  primaryModel: string;
  fallbackModel: string | null;
  modelConfig: ModelConfig;
  toolCtx: ToolContext;
  context: RetrievedChunk[];
}

export type PrepareTurnResult = { paused: true; sessionId: string } | { paused: false; turn: PreparedTurn };

export type BrainStreamEvent = { type: "chunk"; text: string } | { type: "done"; result: BrainTurnOutput };

/**
 * Everything about a turn that doesn't involve talking to the model: config
 * checks, rate limiting, conversation/session bookkeeping, RAG retrieval,
 * and prompt assembly. Split from streamBrainTurn so a route handler can
 * surface config/rate-limit/pause outcomes as normal HTTP responses (503,
 * 429, a plain JSON "paused" reply) and only open an SSE stream once it
 * knows the model is actually about to be called.
 */
export async function prepareBrainTurn(input: BrainTurnInput): Promise<PrepareTurnResult> {
  if (!isOpenRouterConfigured() || !isSupabaseServiceConfigured()) {
    throw new BrainNotConfiguredError();
  }

  const { channel, channelSessionId, locale, userMessage, ip } = input;

  const allowed = await checkRateLimit(channel, channelSessionId, ip ?? null);
  if (!allowed) throw new RateLimitError();

  const conversation = await getOrCreateConversation(channel, channelSessionId, locale);
  await upsertUnifiedUser(channel, channelSessionId);

  await appendMessage(conversation.id, "user", userMessage);

  if (conversation.botPaused) {
    return { paused: true, sessionId: conversation.id };
  }

  const modelConfig = await getModelConfig(channel);
  const primaryModel = resolveScheduledModel(modelConfig);

  const [context, { recent, summary }, facts, promptOverride] = await Promise.all([
    retrieveContext(userMessage, locale),
    getConversationContext(conversation),
    conversation.leadEmail ? getLongTermFacts(conversation.leadEmail) : Promise.resolve([]),
    getActivePromptContent(locale),
  ]);

  const systemInstruction = buildSystemInstruction(locale, context, facts, {
    prompt: promptOverride,
    summary,
  });

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemInstruction },
    ...recent.map(
      (m): ChatCompletionMessageParam => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }),
    ),
  ];

  const client = getOpenRouterClient()!;
  const toolCtx: ToolContext = {
    conversationId: conversation.id,
    channel,
    externalUserId: channelSessionId,
    locale,
  };

  return {
    paused: false,
    turn: { conversation, locale, messages, client, primaryModel, fallbackModel: modelConfig.fallbackModel, modelConfig, toolCtx, context },
  };
}

type StreamParams = {
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  temperature: number;
  top_p: number;
  max_tokens: number;
};

/**
 * Opens a completion stream with the primary model, retrying once with
 * model_config.fallback_model if the request itself fails (a 429, the
 * primary slug being temporarily unavailable, etc). Only covers failures
 * before the first chunk arrives — once a stream has started yielding
 * content there's no clean way to restart it without duplicating what the
 * visitor already saw, so a mid-stream failure just ends the turn with
 * whatever text arrived.
 */
async function openStreamWithFallback(
  client: OpenAI,
  primaryModel: string,
  fallbackModel: string | null,
  params: StreamParams,
): Promise<{ stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>; modelUsed: string }> {
  try {
    const stream = await client.chat.completions.create({
      model: primaryModel,
      stream: true,
      stream_options: { include_usage: true },
      ...params,
    });
    return { stream, modelUsed: primaryModel };
  } catch (err) {
    if (fallbackModel && fallbackModel !== primaryModel) {
      console.error(`[brain] ${primaryModel} failed, retrying with fallback ${fallbackModel}:`, err);
      try {
        const stream = await client.chat.completions.create({
          model: fallbackModel,
          stream: true,
          stream_options: { include_usage: true },
          ...params,
        });
        return { stream, modelUsed: fallbackModel };
      } catch (fallbackErr) {
        if (isRateLimitError(fallbackErr)) throw new RateLimitError();
        throw fallbackErr;
      }
    }
    if (isRateLimitError(err)) throw new RateLimitError();
    throw err;
  }
}

interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * The single entry point every surface calls once it has a PreparedTurn from
 * prepareBrainTurn — web, Telegram (via runBrainTurn below), widget. Yields
 * "chunk" events as the model's final answer streams in (tool-calling
 * iterations happen silently between chunks), then one "done" event with the
 * persisted message id/sources, same shape the old non-streaming
 * runBrainTurn returned.
 */
export async function* streamBrainTurn(turn: PreparedTurn): AsyncGenerator<BrainStreamEvent> {
  const { conversation, locale, messages, client, primaryModel, fallbackModel, modelConfig, toolCtx, context } = turn;

  let reply = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let modelUsedForReply = primaryModel;

  for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
    const { stream, modelUsed } = await openStreamWithFallback(client, primaryModel, fallbackModel, {
      messages,
      tools: openAiToolDeclarations,
      temperature: modelConfig.temperature,
      top_p: modelConfig.topP,
      max_tokens: modelConfig.maxTokens,
    });
    modelUsedForReply = modelUsed;

    let contentAcc = "";
    const toolCallsAcc = new Map<number, AccumulatedToolCall>();

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;

      if (delta?.content) {
        contentAcc += delta.content;
        yield { type: "chunk", text: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const existing = toolCallsAcc.get(idx) ?? { id: "", name: "", arguments: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          toolCallsAcc.set(idx, existing);
        }
      }

      if (chunk.usage) {
        tokensIn = chunk.usage.prompt_tokens ?? tokensIn;
        tokensOut = chunk.usage.completion_tokens ?? tokensOut;
      }
    }

    const calls = Array.from(toolCallsAcc.entries())
      .sort(([a], [b]) => a - b)
      .map(([, call]) => call)
      .filter((call) => call.name);

    if (calls.length === 0) {
      reply = contentAcc;
      break;
    }

    if (iteration === MAX_TOOL_ITERATIONS) {
      // Hit the loop cap without a final answer — stop calling tools and
      // answer with whatever text came back, or the locale fallback.
      reply = contentAcc || FALLBACK_REPLY[locale];
      break;
    }

    messages.push({
      role: "assistant",
      content: contentAcc || null,
      tool_calls: calls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
      })),
    });

    for (const call of calls) {
      let args: unknown = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        // leave args as {} — the tool's own zod schema will reject it as invalid_arguments
      }

      const result = await dispatchTool(call.name, args, toolCtx);

      await appendMessage(conversation.id, "tool", `${call.name}(${call.arguments})`, {
        toolName: call.name,
        toolPayload: result,
      });

      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  const finalReply = reply.trim() || FALLBACK_REPLY[locale];
  const sources = Array.from(new Set(context.map((c) => c.documentTitle)));

  const messageId = await appendMessage(conversation.id, "assistant", finalReply, {
    modelUsed: modelUsedForReply,
    tokensIn,
    tokensOut,
    retrievedChunkIds: context.map((c) => c.id),
  });

  yield { type: "done", result: { reply: finalReply, sessionId: conversation.id, messageId, sources } };
}

/**
 * Non-streaming compatibility wrapper — Telegram delivers one message per
 * turn via the Bot API (no token-by-token surface to stream into), so it
 * drains streamBrainTurn internally and returns the final result, same
 * contract this function had before streaming existed.
 */
export async function runBrainTurn(input: BrainTurnInput): Promise<BrainTurnOutput> {
  const prepared = await prepareBrainTurn(input);
  if (prepared.paused) {
    return { reply: "", sessionId: prepared.sessionId, messageId: "", sources: [], paused: true };
  }

  for await (const event of streamBrainTurn(prepared.turn)) {
    if (event.type === "done") return event.result;
  }

  // Unreachable — streamBrainTurn always yields a "done" event before returning.
  throw new Error("stream ended without a result");
}
