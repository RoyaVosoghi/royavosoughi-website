import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";

import { requireRole, type AdminRole, type CurrentAdmin } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";

/**
 * Shared plumbing for the V5 CRM route handlers, which all follow the same
 * order: session + role → zod validation → operation → audit → response.
 */

/** Typed audit actions for the CRM documents/campaigns — a typo is a compile error, not a silent new action string. */
export type CrmAuditAction =
  | "proposal.create"
  | "proposal.update"
  | "proposal.send"
  | "proposal.cancel"
  | "proposal.reopen"
  | "proposal.delete"
  | "proposal.reply"
  | "proposal.convert"
  | "contract.create"
  | "contract.update"
  | "contract.send"
  | "contract.share_link"
  | "contract.cancel"
  | "contract.reopen"
  | "contract.delete"
  | "contract.ai_rewrite"
  | "contract.ai_followup"
  | "campaign.create"
  | "campaign.delete"
  | "campaign.email_generate"
  | "campaign.email_update"
  | "campaign.email_send"
  | "assistant.query";

/** Awaited on purpose: on serverless, a fire-and-forget insert can be cut off once the response is sent. */
export async function audit(action: CrmAuditAction, target?: string | null): Promise<void> {
  await writeAuditLog(action, target ?? null);
}

export async function gate(min: AdminRole): Promise<{ admin: CurrentAdmin } | { response: NextResponse }> {
  const result = await requireRole(min);
  if (!result.ok) return { response: NextResponse.json({ error: "unauthorized" }, { status: result.status }) };
  return { admin: result.admin };
}

export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: NextResponse.json({ error: "invalid_json" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { response: NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 }) };
  }
  return { data: parsed.data };
}

/** Writer failure → API error code/status the editors know how to word. */
export const AI_ERROR = {
  not_configured: { code: "ai_not_configured", status: 503 },
  no_credits: { code: "ai_no_credits", status: 402 },
  failed: { code: "ai_failed", status: 502 },
} as const;

export function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

/** Origin of the current request — links in emails then point at whichever deployment sent them (prod, preview, localhost). */
export function requestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${proto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

/** Base64 PDF from the browser: must decode to a real PDF under the size budget. */
export function decodePdf(base64: string): Buffer | null {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length < 100 || buffer.length > 3.2 * 1024 * 1024) return null;
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
  return buffer;
}
