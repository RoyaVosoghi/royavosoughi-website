import "server-only";

import type { FunctionDeclaration } from "@google/genai";

import type { Channel, Locale } from "../types";
import { requestHumanHandoffDeclaration, executeRequestHumanHandoff } from "./handoff";
import { captureLeadDeclaration, executeCaptureLead } from "./lead";
import { checkRegistrationStatusDeclaration, executeCheckRegistrationStatus } from "./registration";

export const toolDeclarations: FunctionDeclaration[] = [
  captureLeadDeclaration,
  checkRegistrationStatusDeclaration,
  requestHumanHandoffDeclaration,
];

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
