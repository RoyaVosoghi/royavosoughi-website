import "server-only";

import type OpenAI from "openai";
import { z } from "zod";

import { logAiUsage } from "@/lib/admin/queries";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

import { estimateCostUsd } from "./model-catalog";
import { getOpenRouterClient } from "./providers/openrouter";

/**
 * "Chat with your CRM" — the model answers only from four read-only tools
 * over live data. Each tool's arguments are zod-validated before touching
 * the database; results are trimmed to the fields an analysis needs.
 * Streaming: text deltas are forwarded as they arrive; when the model asks
 * for tools instead, they run and the loop continues (max MAX_ROUNDS).
 */

const ASSISTANT_MODEL = "google/gemini-2.5-flash";
const MAX_ROUNDS = 5;

const SYSTEM_PROMPT = `You are the CRM analyst for Roya Vosoughi, a solo AI engineer and consultant. You answer questions about her leads, deals, activities, proposals and contracts.

Rules:
- Every number, name and fact in your answer must come from a tool result in this conversation. Never estimate or invent figures; if the tools don't return it, say you don't have that data.
- Call tools first, then answer. Prefer crm_stats for totals and the query tools for specific lists.
- Amounts are stored in cents with a currency — convert to whole units and never add amounts in different currencies together.
- Reply in the language of the question (English or Persian). Be concise and analytical: lead with the answer, then 2–5 bullet points of supporting detail, then (if useful) one suggested next action.
- Today's date is ${new Date().toISOString().slice(0, 10)}.`;

function requireClient() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");
  return supabase;
}

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

const QueryLeadsArgs = z.object({
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
  source: z.string().max(40).optional(),
  minScore: z.number().min(0).max(100).optional(),
  sinceDays: z.number().int().min(1).max(3650).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const QueryDealsArgs = z.object({
  status: z.enum(["open", "won", "lost"]).optional(),
  stageName: z.string().max(60).optional(),
  minAmount: z.number().min(0).optional(),
  closedSinceDays: z.number().int().min(1).max(3650).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const QueryActivitiesArgs = z.object({
  type: z.enum(["call", "meeting", "note", "task"]).optional(),
  openOnly: z.boolean().optional(),
  overdueOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const CrmStatsArgs = z.object({});

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "query_leads",
      description: "List inbound leads (website form / chatbot), newest first, with status, source, AI score and stated challenge.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["new", "contacted", "qualified", "converted", "lost"] },
          source: { type: "string", description: "e.g. website, chatbot, widget, telegram" },
          minScore: { type: "number", description: "Minimum AI lead score 0-100" },
          sinceDays: { type: "integer", description: "Only leads created in the last N days" },
          limit: { type: "integer", description: "Max rows, default 20, max 50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_deals",
      description: "List deals with stage, status, amount (cents + currency), contact, company and days in the pipeline.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "won", "lost"] },
          stageName: { type: "string", description: "Pipeline stage name, e.g. Proposal" },
          minAmount: { type: "number", description: "Minimum amount in whole currency units" },
          closedSinceDays: { type: "integer", description: "Only deals closed in the last N days" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_activities",
      description: "List calls, meetings, notes and tasks with due dates and completion state.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["call", "meeting", "note", "task"] },
          openOnly: { type: "boolean", description: "Only not-completed items" },
          overdueOnly: { type: "boolean", description: "Only open items whose due date has passed" },
          limit: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_stats",
      description:
        "Totals: leads by status and source, open pipeline value per stage, won/lost counts and won revenue per currency (last 30/90/365 days), overdue tasks, proposals and contracts by status.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function queryLeads(args: z.infer<typeof QueryLeadsArgs>) {
  const supabase = requireClient();
  let q = supabase
    .from("leads")
    .select("name, company_name, status, source, interest, ai_score, ai_score_reason, created_at")
    .order("created_at", { ascending: false })
    .limit(args.limit);
  if (args.status) q = q.eq("status", args.status);
  if (args.source) q = q.eq("source", args.source);
  if (args.minScore !== undefined) q = q.gte("ai_score", args.minScore);
  if (args.sinceDays) q = q.gte("created_at", new Date(Date.now() - args.sinceDays * 86_400_000).toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

async function queryDeals(args: z.infer<typeof QueryDealsArgs>) {
  const supabase = requireClient();
  let q = supabase
    .from("deals")
    .select("title, status, amount_cents, currency, expected_close_date, closed_at, created_at, updated_at, ai_next_action, contacts(name), companies(name), pipeline_stages(name)")
    .order("updated_at", { ascending: false })
    .limit(args.stageName ? 200 : args.limit);
  if (args.status) q = q.eq("status", args.status);
  if (args.minAmount !== undefined) q = q.gte("amount_cents", Math.round(args.minAmount * 100));
  if (args.closedSinceDays) q = q.gte("closed_at", new Date(Date.now() - args.closedSinceDays * 86_400_000).toISOString());
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []).map((d) => ({
    title: d.title,
    stage: one(d.pipeline_stages as { name: string } | { name: string }[] | null)?.name ?? null,
    status: d.status,
    amount: (d.amount_cents ?? 0) / 100,
    currency: d.currency,
    contact: one(d.contacts as { name: string } | { name: string }[] | null)?.name ?? null,
    company: one(d.companies as { name: string } | { name: string }[] | null)?.name ?? null,
    expectedClose: d.expected_close_date,
    closedAt: d.closed_at,
    daysSinceUpdate: Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86_400_000),
    aiNextAction: d.ai_next_action,
  }));
  const filtered = args.stageName ? rows.filter((r) => r.stage?.toLowerCase() === args.stageName!.toLowerCase()) : rows;
  return filtered.slice(0, args.limit);
}

async function queryActivities(args: z.infer<typeof QueryActivitiesArgs>) {
  const supabase = requireClient();
  let q = supabase
    .from("activities")
    .select("type, subject, due_at, completed_at, created_at, contacts(name)")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(args.limit);
  if (args.type) q = q.eq("type", args.type);
  if (args.openOnly || args.overdueOnly) q = q.is("completed_at", null);
  if (args.overdueOnly) q = q.lt("due_at", new Date().toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((a) => ({
    type: a.type,
    subject: a.subject,
    contact: one(a.contacts as { name: string } | { name: string }[] | null)?.name ?? null,
    dueAt: a.due_at,
    completedAt: a.completed_at,
  }));
}

async function crmStats() {
  const supabase = requireClient();
  const now = Date.now();
  const [leads, deals, stages, overdue, proposals, contracts] = await Promise.all([
    supabase.from("leads").select("status, source"),
    supabase.from("deals").select("status, amount_cents, currency, closed_at, pipeline_stage_id"),
    supabase.from("pipeline_stages").select("id, name, sort_order").order("sort_order"),
    supabase.from("activities").select("id", { count: "exact", head: true }).is("completed_at", null).lt("due_at", new Date().toISOString()),
    supabase.from("proposals").select("status"),
    supabase.from("contracts").select("status"),
  ]);
  for (const r of [leads, deals, stages]) if (r.error) throw r.error;

  const countBy = <T,>(rows: T[] | null | undefined, key: (row: T) => string) =>
    (rows ?? []).reduce<Record<string, number>>((acc, row) => {
      const k = key(row);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  const pipeline = (stages.data ?? []).map((stage) => {
    const open = (deals.data ?? []).filter((d) => d.status === "open" && d.pipeline_stage_id === stage.id);
    const valueByCurrency = open.reduce<Record<string, number>>((acc, d) => {
      acc[d.currency] = (acc[d.currency] ?? 0) + (d.amount_cents ?? 0) / 100;
      return acc;
    }, {});
    return { stage: stage.name, openDeals: open.length, valueByCurrency };
  });

  const revenue = (days: number) =>
    (deals.data ?? [])
      .filter((d) => d.status === "won" && d.closed_at && now - new Date(d.closed_at).getTime() <= days * 86_400_000)
      .reduce<Record<string, number>>((acc, d) => {
        acc[d.currency] = (acc[d.currency] ?? 0) + (d.amount_cents ?? 0) / 100;
        return acc;
      }, {});

  return {
    leadsByStatus: countBy(leads.data, (l) => l.status ?? "new"),
    leadsBySource: countBy(leads.data, (l) => l.source ?? "unknown"),
    dealsByStatus: countBy(deals.data, (d) => d.status),
    openPipelineByStage: pipeline,
    wonRevenue: { last30Days: revenue(30), last90Days: revenue(90), last365Days: revenue(365) },
    overdueTasks: overdue.count ?? 0,
    proposalsByStatus: proposals.error ? "unavailable" : countBy(proposals.data, (p) => p.status),
    contractsByStatus: contracts.error ? "unavailable" : countBy(contracts.data, (c) => c.status),
  };
}

async function runTool(name: string, rawArgs: string): Promise<unknown> {
  let args: unknown = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { error: "invalid_json_arguments" };
  }
  try {
    switch (name) {
      case "query_leads": {
        const parsed = QueryLeadsArgs.safeParse(args);
        return parsed.success ? await queryLeads(parsed.data) : { error: parsed.error.issues[0]?.message };
      }
      case "query_deals": {
        const parsed = QueryDealsArgs.safeParse(args);
        return parsed.success ? await queryDeals(parsed.data) : { error: parsed.error.issues[0]?.message };
      }
      case "query_activities": {
        const parsed = QueryActivitiesArgs.safeParse(args);
        return parsed.success ? await queryActivities(parsed.data) : { error: parsed.error.issues[0]?.message };
      }
      case "crm_stats": {
        CrmStatsArgs.parse(args ?? {});
        return await crmStats();
      }
      default:
        return { error: `unknown tool ${name}` };
    }
  } catch (err) {
    console.error(`[crm-assistant] tool ${name} failed:`, err);
    return { error: "tool_failed" };
  }
}

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export type AssistantEvent = { type: "text"; text: string } | { type: "tool"; name: string };

export async function* streamCrmAssistant(history: AssistantTurn[]): AsyncGenerator<AssistantEvent> {
  const client = getOpenRouterClient();
  if (!client) throw new Error("not_configured");

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
  ];

  let tokensIn = 0;
  let tokensOut = 0;

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const stream = await client.chat.completions.create({
        model: ASSISTANT_MODEL,
        messages,
        tools: TOOLS,
        max_tokens: 4000,
        stream: true,
        stream_options: { include_usage: true },
      });

      let text = "";
      const calls: Array<{ id: string; name: string; args: string }> = [];

      for await (const chunk of stream) {
        if (chunk.usage) {
          tokensIn += chunk.usage.prompt_tokens ?? 0;
          tokensOut += chunk.usage.completion_tokens ?? 0;
        }
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          text += delta.content;
          yield { type: "text", text: delta.content };
        }
        for (const call of delta.tool_calls ?? []) {
          const slot = (calls[call.index] ??= { id: "", name: "", args: "" });
          if (call.id) slot.id = call.id;
          if (call.function?.name) slot.name += call.function.name;
          if (call.function?.arguments) slot.args += call.function.arguments;
        }
      }

      const toolCalls = calls.filter((c) => c.name);
      if (!toolCalls.length) return;

      messages.push({
        role: "assistant",
        content: text || null,
        tool_calls: toolCalls.map((c, i) => ({
          id: c.id || `call_${round}_${i}`,
          type: "function" as const,
          function: { name: c.name, arguments: c.args || "{}" },
        })),
      });
      for (const [i, call] of toolCalls.entries()) {
        yield { type: "tool", name: call.name };
        const result = await runTool(call.name, call.args);
        messages.push({ role: "tool", tool_call_id: call.id || `call_${round}_${i}`, content: JSON.stringify(result).slice(0, 24000) });
      }
    }
  } finally {
    const cost = tokensIn || tokensOut ? estimateCostUsd(ASSISTANT_MODEL, tokensIn, tokensOut) : null;
    await logAiUsage("crm_assistant", tokensIn || null, tokensOut || null, cost);
  }
}
