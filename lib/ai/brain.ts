import "server-only";

import { ThinkingLevel, type Content, type GenerateContentResponse, type GoogleGenAI, type Part } from "@google/genai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type OpenAI from "openai";

import { site } from "@/lib/site";
import { getSupabaseAdminClient, isSupabaseServiceConfigured } from "@/lib/supabase-admin";
import { getGeminiClient, isGeminiConfigured } from "./gemini";
import { INJECTION_GUARD_REPLY, looksLikePromptInjection } from "./injection-guard";
import { appendMessage, getConversationContext, getLongTermFacts, getOrCreateConversation, upsertUnifiedUser, type Conversation } from "./memory";
import { getModelConfig, resolveScheduledModel, type ModelConfig } from "./model-config";
import { getOpenRouterClient, isOpenRouterConfigured, isRateLimitError } from "./providers/openrouter";
import { buildSystemInstruction } from "./prompt";
import { getActivePromptContent } from "./prompt-versions";
import { checkRateLimit } from "./rate-limit";
import { retrieveContext, type RetrievedChunk } from "./retrieval";
import { getSecurityConfig, isOutsideWorkingHours } from "./security-config";
import { dispatchTool, openAiToolDeclarations, toolDeclarations, type ToolContext } from "./tools";
import { BrainNotConfiguredError, RateLimitError, type BrainTurnInput, type BrainTurnOutput, type Locale } from "./types";

const MAX_TOOL_ITERATIONS = 3;

/** Used by page components to decide whether to render the chat UI at all — true once the DB and at least one model provider are configured (which one a given channel actually uses is decided per-channel by model_config.provider). */
export function isBrainConfigured(): boolean {
  return (isOpenRouterConfigured() || isGeminiConfigured()) && isSupabaseServiceConfigured();
}

const FALLBACK_REPLY: Record<"en" | "fa", string> = {
  en: "Sorry, I couldn't put together a reply just now. Please try again in a moment.",
  fa: "متاسفم، الان نتوانستم پاسخ بدهم. لطفاً کمی بعد دوباره امتحان کنید.",
};

/** Shown when every model failed or timed out before saying anything — usually the provider is overloaded, so give the visitor a way to reach Roya that doesn't depend on it. */
const BUSY_REPLY: Record<"en" | "fa", string> = {
  en: `Sorry, I'm getting more requests than I can answer right now. Please try again in a minute, or email Roya directly at ${site.email}.`,
  fa: `متأسفم، الان درخواست‌ها بیشتر از توان پاسخ‌گویی من است. لطفاً یک دقیقه‌ی دیگر دوباره امتحان کنید، یا مستقیماً به رویا ایمیل بزنید: ${site.email}`,
};

interface PreparedTurn {
  conversation: Conversation;
  locale: Locale;
  messages: ChatCompletionMessageParam[];
  client: OpenAI | null;
  primaryModel: string;
  fallbackModel: string | null;
  modelConfig: ModelConfig;
  toolCtx: ToolContext;
  context: RetrievedChunk[];
  /** Set when the injection guard caught the message — streamBrainTurn replies with this and never calls a model. */
  cannedReply?: string;
}

/** Recorded as messages.model_used on guard replies, so they're easy to find in the admin inbox. */
const INJECTION_GUARD_MODEL = "injection-guard";

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
  if ((!isOpenRouterConfigured() && !isGeminiConfigured()) || !isSupabaseServiceConfigured()) {
    throw new BrainNotConfiguredError();
  }

  const { channel, channelSessionId, locale, userMessage, ip } = input;

  const allowed = await checkRateLimit(channel, channelSessionId, ip ?? null);
  if (!allowed) throw new RateLimitError();

  // Already cached by checkRateLimit above, so this is free.
  const securityConfig = await getSecurityConfig();
  const blocked = securityConfig.injectionGuardEnabled && looksLikePromptInjection(userMessage);

  // Lookups that don't depend on the conversation row start right away, so
  // the embedding call and config reads overlap the session bookkeeping
  // below instead of queuing behind it. All three fail soft (they log and
  // return a default), so an unused result on the paused path is harmless.
  // A guarded message skips retrieval entirely — no embedding call either.
  const contextPromise = blocked ? Promise.resolve<RetrievedChunk[]>([]) : retrieveContext(userMessage, locale);
  const modelConfigPromise = getModelConfig(channel);
  const promptPromise = getActivePromptContent(locale);

  const conversation = await getOrCreateConversation(channel, channelSessionId, locale);
  await Promise.all([upsertUnifiedUser(channel, channelSessionId), appendMessage(conversation.id, "user", userMessage)]);

  if (conversation.botPaused) {
    return { paused: true, sessionId: conversation.id };
  }

  const modelConfig = await modelConfigPromise;
  const primaryModel = resolveScheduledModel(modelConfig);
  const toolCtx: ToolContext = {
    conversationId: conversation.id,
    channel,
    externalUserId: channelSessionId,
    locale,
  };

  if (blocked) {
    // Flag for review like a 👎 does, so attempts show up in the admin inbox.
    await getSupabaseAdminClient()?.from("conversations").update({ flagged: true }).eq("id", conversation.id);
    return {
      paused: false,
      turn: {
        conversation,
        locale,
        messages: [],
        client: null,
        primaryModel: INJECTION_GUARD_MODEL,
        fallbackModel: null,
        modelConfig,
        toolCtx,
        context: [],
        cannedReply: INJECTION_GUARD_REPLY[locale],
      },
    };
  }

  if (modelConfig.provider === "gemini" ? !isGeminiConfigured() : !isOpenRouterConfigured()) {
    throw new BrainNotConfiguredError();
  }

  const [context, { recent, summary }, facts, promptOverride] = await Promise.all([
    contextPromise,
    getConversationContext(conversation),
    conversation.leadEmail ? getLongTermFacts(conversation.leadEmail) : Promise.resolve([]),
    promptPromise,
  ]);

  const systemInstruction = buildSystemInstruction(locale, context, facts, {
    prompt: promptOverride,
    summary,
    channel,
    outsideWorkingHours: isOutsideWorkingHours(securityConfig.workingHours),
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

  const client = modelConfig.provider === "gemini" ? null : getOpenRouterClient();

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
/**
 * OpenRouter-specific extension, not in the OpenAI SDK's request types.
 * `exclude: true` keeps the model's internal reasoning pass (for models that
 * have one, e.g. NVIDIA's Nemotron nano/reasoning line) but drops it from
 * the response — without this, some reasoning-capable models return their
 * chain-of-thought as ordinary `content` (visible chat text) instead of the
 * separate `reasoning` field, which showed up live as the visitor-facing
 * reply starting with things like "The user asks..." or reciting raw prompt
 * sections. Harmless to send to non-reasoning models; OpenRouter ignores
 * parameters a given model doesn't support.
 */
const REASONING_PARAMS = { reasoning: { exclude: true } };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function openStream(client: OpenAI, model: string, params: StreamParams) {
  return client.chat.completions.create({
    model,
    stream: true,
    stream_options: { include_usage: true },
    ...params,
    ...REASONING_PARAMS,
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);
}

/**
 * Free-tier OpenRouter models occasionally 429/5xx on a request that would
 * have succeeded a second later (provider-side capacity blips, not a real
 * rate limit on us) — one short-backoff retry absorbs that class of failure
 * before we give up on a model entirely and move to the fallback. A genuine
 * rate-limit error is never retried here — isRateLimitError callers handle
 * that themselves by surfacing RateLimitError to the visitor.
 */
async function openStreamWithRetry(client: OpenAI, model: string, params: StreamParams) {
  try {
    return await openStream(client, model, params);
  } catch (err) {
    if (isRateLimitError(err)) throw err;
    await sleep(400);
    return openStream(client, model, params);
  }
}

async function openStreamWithFallback(
  client: OpenAI,
  primaryModel: string,
  fallbackModel: string | null,
  params: StreamParams,
): Promise<{ stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>; modelUsed: string }> {
  try {
    const stream = await openStreamWithRetry(client, primaryModel, params);
    return { stream, modelUsed: primaryModel };
  } catch (err) {
    if (fallbackModel && fallbackModel !== primaryModel) {
      console.error(`[brain] ${primaryModel} failed, retrying with fallback ${fallbackModel}:`, err);
      try {
        const stream = await openStreamWithRetry(client, fallbackModel, params);
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
 * OpenRouter's OpenAI-compatible path — kept fully working even while a
 * channel is set to provider 'gemini' (see streamBrainTurnGemini below), so
 * switching a channel back to an OpenRouter model is a model_config change,
 * not a code change.
 */
async function* streamBrainTurnOpenRouter(turn: PreparedTurn): AsyncGenerator<BrainStreamEvent> {
  const { conversation, locale, messages, client, primaryModel, fallbackModel, modelConfig, toolCtx, context } = turn;
  if (!client) throw new Error("streamBrainTurnOpenRouter called without an OpenRouter client");

  let reply = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let modelUsedForReply = primaryModel;
  // Free-tier models occasionally get rejected outright by the provider's
  // own moderation (seen live on jailbreak-phrased prompts like "ignore all
  // previous instructions" — both primary and fallback erroring instantly
  // while ordinary prompts succeed). If that happens before any visible
  // text has streamed, degrade to a locale-appropriate reply instead of
  // leaving the visitor with a bare error — there's nothing to preserve or
  // duplicate yet. Once real content has streamed, a later failure is
  // treated as before (surfaced as an SSE "error" — see openStreamWithFallback's
  // docstring for why a mid-stream failure can't cleanly restart).
  let hasStreamedContent = false;

  try {
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
          hasStreamedContent = true;
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
  } catch (err) {
    if (hasStreamedContent) throw err;
    console.error("[brain] streamBrainTurn: both models failed before any content streamed, degrading gracefully:", err);
    reply = BUSY_REPLY[locale];
  }

  yield await finishTurn(conversation, context, reply, locale, modelUsedForReply, tokensIn, tokensOut);
}

/** Shared by both provider branches: persists the final reply and builds the "done" event. */
async function finishTurn(
  conversation: Conversation,
  context: RetrievedChunk[],
  reply: string,
  locale: Locale,
  modelUsedForReply: string,
  tokensIn: number | undefined,
  tokensOut: number | undefined,
): Promise<BrainStreamEvent> {
  const finalReply = reply.trim() || FALLBACK_REPLY[locale];
  const sources = Array.from(new Set(context.map((c) => c.documentTitle)));

  const messageId = await appendMessage(conversation.id, "assistant", finalReply, {
    modelUsed: modelUsedForReply,
    tokensIn,
    tokensOut,
    retrievedChunkIds: context.map((c) => c.id),
  });

  return { type: "done", result: { reply: finalReply, sessionId: conversation.id, messageId, sources } };
}

/**
 * Collapses the OpenAI-shaped message history prepareBrainTurn built into
 * Gemini's Content[] shape. Mirrors the OpenRouter path's own collapse of
 * "tool" role history into plain "user" text (see prepareBrainTurn) — the
 * system message becomes systemInstruction, everything else becomes a
 * plain text turn (role "model" for the assistant, "user" for everything
 * else), never reconstructing past tool-call/response structure.
 */
function toGeminiContents(messages: ChatCompletionMessageParam[]): { systemInstruction: string; contents: Content[] } {
  let systemInstruction = "";
  const contents: Content[] = [];
  for (const m of messages) {
    const text = typeof m.content === "string" ? m.content : "";
    if (m.role === "system") {
      systemInstruction = text;
    } else if (text) {
      contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text }] });
    }
  }
  return { systemInstruction, contents };
}

/**
 * How long a Gemini model gets to send its first chunk before we give up on
 * it. Normal first-chunk time is a few seconds; when Google is overloaded a
 * request either fails fast with a 503 or hangs for a minute or more, and a
 * visitor watching a typing indicator won't wait that long. Primary + fallback
 * together stay under ~25s.
 */
const GEMINI_FIRST_CHUNK_TIMEOUT_MS = { primary: 10_000, fallback: 14_000 };

class ModelTimeoutError extends Error {}

/**
 * Opens a Gemini stream and waits for its first chunk, aborting the request
 * if nothing arrives within timeoutMs. Returns a stream that replays that
 * first chunk, so callers iterate it as if nothing happened. The timeout only
 * covers the wait for the first chunk — once the model is talking, a slow
 * tail is left alone.
 */
async function openGeminiStream(
  client: GoogleGenAI,
  model: string,
  contents: Content[],
  systemInstruction: string,
  params: { temperature: number; topP: number; maxOutputTokens: number },
  timeoutMs: number,
): Promise<AsyncIterable<GenerateContentResponse>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const stream = await client.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
        // includeThoughts keeps the model's internal reasoning out of
        // visible text — see the module docstring above streamBrainTurnGemini.
        // LOW keeps that silent reasoning pass short: the default level made
        // the visitor wait several seconds before the first word.
        thinkingConfig: { includeThoughts: false, thinkingLevel: ThinkingLevel.LOW },
        temperature: params.temperature,
        topP: params.topP,
        maxOutputTokens: params.maxOutputTokens,
        abortSignal: controller.signal,
      },
    });
    const first = await stream.next();
    clearTimeout(timer);
    return (async function* () {
      if (!first.done) yield first.value;
      yield* stream;
    })();
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) throw new ModelTimeoutError(`${model} sent nothing within ${timeoutMs}ms`);
    throw err;
  }
}

/**
 * Native Gemini path (google/genai SDK, not OpenRouter's proxy) — used when
 * model_config.provider is 'gemini'. Function calls arrive whole in a single
 * chunk (no incremental JSON-string accumulation like the OpenAI-shaped
 * path needs), and thinkingConfig.includeThoughts stays false so the
 * model's internal reasoning never lands in visible `chunk.text` — verified
 * live that this also holds up against jailbreak-phrased prompts that
 * broke free-tier OpenRouter models outright.
 */
async function* streamBrainTurnGemini(turn: PreparedTurn): AsyncGenerator<BrainStreamEvent> {
  const { conversation, locale, messages, primaryModel, fallbackModel, modelConfig, toolCtx, context } = turn;
  const geminiClient = getGeminiClient();
  if (!geminiClient) throw new Error("streamBrainTurnGemini called without a configured Gemini client");

  const { systemInstruction, contents } = toGeminiContents(messages);

  let reply = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  let modelUsedForReply = primaryModel;
  let hasStreamedContent = false;

  try {
    for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
      const genParams = {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        maxOutputTokens: modelConfig.maxTokens,
      };

      // No same-model retry here: when Gemini is overloaded, retrying the
      // model that just 503'd or timed out only adds waiting — moving
      // straight to the fallback is the faster path to a reply.
      let stream: AsyncIterable<GenerateContentResponse>;
      let modelUsed = primaryModel;
      try {
        stream = await openGeminiStream(geminiClient, primaryModel, contents, systemInstruction, genParams, GEMINI_FIRST_CHUNK_TIMEOUT_MS.primary);
      } catch (err) {
        if (fallbackModel && fallbackModel !== primaryModel) {
          console.error(`[brain] gemini ${primaryModel} failed, trying fallback ${fallbackModel}:`, err);
          stream = await openGeminiStream(geminiClient, fallbackModel, contents, systemInstruction, genParams, GEMINI_FIRST_CHUNK_TIMEOUT_MS.fallback);
          modelUsed = fallbackModel;
        } else {
          throw err;
        }
      }
      modelUsedForReply = modelUsed;

      let textAcc = "";
      const functionCallParts: Part[] = [];
      const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

      for await (const chunk of stream) {
        if (chunk.text) {
          textAcc += chunk.text;
          hasStreamedContent = true;
          yield { type: "chunk", text: chunk.text };
        }

        if (chunk.functionCalls?.length) {
          for (const fc of chunk.functionCalls) {
            if (fc.name) calls.push({ name: fc.name, args: (fc.args as Record<string, unknown>) ?? {} });
          }
          const parts = chunk.candidates?.[0]?.content?.parts ?? [];
          for (const p of parts) {
            if (p.functionCall) functionCallParts.push(p);
          }
        }

        if (chunk.usageMetadata) {
          tokensIn = chunk.usageMetadata.promptTokenCount ?? tokensIn;
          tokensOut = chunk.usageMetadata.candidatesTokenCount ?? tokensOut;
        }
      }

      if (calls.length === 0) {
        reply = textAcc;
        break;
      }

      if (iteration === MAX_TOOL_ITERATIONS) {
        reply = textAcc || FALLBACK_REPLY[locale];
        break;
      }

      // Preserve the model's turn verbatim (including each functionCall's
      // opaque thoughtSignature) before answering each call, exactly the
      // round-trip shape the Gemini API expects for multi-turn tool use.
      contents.push({ role: "model", parts: functionCallParts.length ? functionCallParts : [{ text: textAcc }] });

      for (const call of calls) {
        const result = await dispatchTool(call.name, call.args, toolCtx);

        await appendMessage(conversation.id, "tool", `${call.name}(${JSON.stringify(call.args)})`, {
          toolName: call.name,
          toolPayload: result,
        });

        contents.push({ role: "user", parts: [{ functionResponse: { name: call.name, response: result } }] });
      }
    }
  } catch (err) {
    if (hasStreamedContent) throw err;
    console.error("[brain] streamBrainTurnGemini: both models failed before any content streamed, degrading gracefully:", err);
    reply = BUSY_REPLY[locale];
  }

  yield await finishTurn(conversation, context, reply, locale, modelUsedForReply, tokensIn, tokensOut);
}

/**
 * The single entry point every surface calls once it has a PreparedTurn from
 * prepareBrainTurn — web, Telegram (via runBrainTurn below), widget. Yields
 * "chunk" events as the model's final answer streams in (tool-calling
 * iterations happen silently between chunks), then one "done" event with the
 * persisted message id/sources, same shape the old non-streaming
 * runBrainTurn returned. Dispatches to whichever provider this channel's
 * model_config actually points at.
 */
export async function* streamBrainTurn(turn: PreparedTurn): AsyncGenerator<BrainStreamEvent> {
  if (turn.cannedReply) {
    yield { type: "chunk", text: turn.cannedReply };
    yield await finishTurn(turn.conversation, [], turn.cannedReply, turn.locale, INJECTION_GUARD_MODEL, undefined, undefined);
  } else if (turn.modelConfig.provider === "gemini") {
    yield* streamBrainTurnGemini(turn);
  } else {
    yield* streamBrainTurnOpenRouter(turn);
  }
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
