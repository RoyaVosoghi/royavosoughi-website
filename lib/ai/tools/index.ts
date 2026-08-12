import "server-only";

import type { FunctionDeclaration } from "@google/genai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

import type { Channel, Locale } from "../types";
import { requestHumanHandoffDeclaration, executeRequestHumanHandoff } from "./handoff";
import { captureLeadDeclaration, executeCaptureLead } from "./lead";
import { checkRegistrationStatusDeclaration, executeCheckRegistrationStatus } from "./registration";

/**
 * Tool declarations are still authored once, in Gemini's FunctionDeclaration
 * shape (name/description/parametersJsonSchema) — brain.ts talks to models
 * exclusively through OpenRouter's OpenAI-compatible API now, so this
 * adapter is the only place that shape needs converting, rather than
 * rewriting every tool file.
 */
const geminiDeclarations: FunctionDeclaration[] = [
  captureLeadDeclaration,
  checkRegistrationStatusDeclaration,
  requestHumanHandoffDeclaration,
];

export const toolDeclarations: FunctionDeclaration[] = geminiDeclarations;

export const openAiToolDeclarations: ChatCompletionTool[] = geminiDeclarations.map((decl) => ({
  type: "function",
  function: {
    name: decl.name!,
    description: decl.description,
    parameters: decl.parametersJsonSchema as Record<string, unknown>,
  },
}));

export interface ToolContext {
  conversationId: string;
  channel: Channel;
  externalUserId: string;
  locale: Locale;
}

export async function dispatchTool(
  name: string,
  args: unknown,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  switch (name) {
    case "capture_lead":
      return executeCaptureLead(args, ctx);
    case "check_registration_status":
      return executeCheckRegistrationStatus(args);
    case "request_human_handoff":
      return executeRequestHumanHandoff(args, ctx);
    default:
      return { error: "unknown_tool" };
  }
}
