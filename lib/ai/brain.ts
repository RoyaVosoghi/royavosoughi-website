import "server-only";

import { ApiError, type Content, type Part } from "@google/genai";

import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";
import { getGeminiClient, isGeminiConfigured } from "./gemini";
import { appendMessage, getConversationContext, getLongTermFacts, getOrCreateConversation, upsertUnifiedUser } from "./memory";
import { getModelConfig } from "./model-config";
import { buildSystemInstruction } from "./prompt";
import { getActivePromptContent } from "./prompt-versions";
import { checkRateLimit } from "./rate-limit";
import { retrieveContext } from "./retrieval";
import { dispatchTool, toolDeclarations } from "./tools";
import { BrainNotConfiguredError, RateLimitError, type BrainTurnInput, type BrainTurnOutput } from "./types";

const MAX_TOOL_ITERATIONS = 3;

const FALLBACK_REPLY: Record<"en" | "fa", string> = {
  en: "Sorry, I couldn't put together a reply just now. Please try again in a moment.",
  fa: "متاسفم، الان نتوانستم پاسخ بدهم. لطفاً کمی بعد دوباره امتحان کنید.",
};

/**
 * The single entry point every surface calls — web, Telegram, widget.
 * Nothing in here or in the modules it calls assumes "website"; channel is
 * just a parameter.
 */
export async function runBrainTurn(input: BrainTurnInput): Promise<BrainTurnOutput> {
  if (!isGeminiConfigured() || !isSupabaseServiceConfigured()) {
    throw new BrainNotConfiguredError();
  }

  const { channel, channelSessionId, locale, userMessage, ip } = input;

  const allowed = await checkRateLimit(channel, channelSessionId, ip ?? null);
  if (!allowed) throw new RateLimitError();

  const conversation = await getOrCreateConversation(channel, channelSessionId, locale);
  await upsertUnifiedUser(channel, channelSessionId);

  await appendMessage(conversation.id, "user", userMessage);

  const modelConfig = await getModelConfig(channel);

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

  const contents: Content[] = recent.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const ai = getGeminiClient()!;
  const toolCtx = {
    conversationId: conversation.id,
    channel,
    externalUserId: channelSessionId,
    locale,
  };

  let reply = "";
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;

  for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
    let response;
    try {
      response = await ai.models.generateContent({
        model: modelConfig.activeModel,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: toolDeclarations }],
          temperature: modelConfig.temperature,
          topP: modelConfig.topP,
          maxOutputTokens: modelConfig.maxTokens,
        },
      });
    } catch (err) {
      // Gemini's own free-tier quota (requests/minute) is stricter than our
      // app-level session/IP limit — a legitimate fast-typing visitor can hit
      // it. Surface it the same way as our own rate limit, not as a generic
      // upstream failure.
      if (err instanceof ApiError && err.status === 429) {
        throw new RateLimitError();
      }
      throw err;
    }

    tokensIn = response.usageMetadata?.promptTokenCount ?? tokensIn;
    tokensOut = response.usageMetadata?.candidatesTokenCount ?? tokensOut;

    const calls = response.functionCalls;

    if (!calls || calls.length === 0) {
      reply = response.text ?? "";
      break;
    }

    if (iteration === MAX_TOOL_ITERATIONS) {
      // Hit the loop cap without a final answer — stop calling tools and
      // answer with whatever text came back, or the locale fallback.
      reply = response.text ?? FALLBACK_REPLY[locale];
      break;
    }

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const responseParts: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      const result = await dispatchTool(name, call.args ?? {}, toolCtx);

      await appendMessage(conversation.id, "tool", `${name}(${JSON.stringify(call.args ?? {})})`, {
        toolName: name,
        toolPayload: result,
      });

      responseParts.push({
        functionResponse: { name, response: result, id: call.id },
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }

  const finalReply = reply.trim() || FALLBACK_REPLY[locale];
  const sources = Array.from(new Set(context.map((c) => c.documentTitle)));

  const messageId = await appendMessage(conversation.id, "assistant", finalReply, {
    modelUsed: modelConfig.activeModel,
    tokensIn,
    tokensOut,
    retrievedChunkIds: context.map((c) => c.id),
  });

  return { reply: finalReply, sessionId: conversation.id, messageId, sources };
}
