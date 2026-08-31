import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { estimateCostUsd } from "./model-catalog";

export interface BudgetConfig {
  monthlyCapUsd: number | null;
  alertThresholdPct: number;
}

export async function getBudgetConfig(): Promise<BudgetConfig> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { monthlyCapUsd: null, alertThresholdPct: 80 };

  const { data, error } = await supabase
    .from("ai_budget_config")
    .select("monthly_cap_usd, alert_threshold_pct")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return { monthlyCapUsd: null, alertThresholdPct: 80 };

  return { monthlyCapUsd: data.monthly_cap_usd, alertThresholdPct: data.alert_threshold_pct };
}

export async function updateBudgetConfig(update: Partial<BudgetConfig>): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.monthlyCapUsd !== undefined) patch.monthly_cap_usd = update.monthlyCapUsd;
  if (update.alertThresholdPct !== undefined) patch.alert_threshold_pct = update.alertThresholdPct;

  const { error } = await supabase.from("ai_budget_config").update(patch).eq("id", 1);
  if (error) throw error;
}

export interface MonthlySpend {
  spentUsd: number;
  byModel: Array<{ model: string; tokensIn: number; tokensOut: number; costUsd: number }>;
  /** Lead scoring / contact summaries / deal next-action calls (ai_usage_log) — these don't produce a `messages` row, so they're tracked separately and folded into spentUsd. */
  crmAiUsd: number;
}

/** Sums estimated chat cost from messages.model_used/tokens_in/tokens_out, plus logged CRM AI usage (ai_usage_log), for the current calendar month — an estimate from the catalog's static pricing, not a real invoice. */
export async function getMonthlySpend(): Promise<MonthlySpend> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { spentUsd: 0, byModel: [], crmAiUsd: 0 };

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [messagesResult, crmUsageResult] = await Promise.all([
    supabase
      .from("messages")
      .select("model_used, tokens_in, tokens_out")
      .eq("role", "assistant")
      .not("model_used", "is", null)
      .gte("created_at", monthStart.toISOString()),
    supabase.from("ai_usage_log").select("cost_usd").gte("created_at", monthStart.toISOString()),
  ]);

  const byModelMap = new Map<string, { tokensIn: number; tokensOut: number }>();
  for (const row of (messagesResult.data ?? []) as Array<{
    model_used: string;
    tokens_in: number | null;
    tokens_out: number | null;
  }>) {
    const entry = byModelMap.get(row.model_used) ?? { tokensIn: 0, tokensOut: 0 };
    entry.tokensIn += row.tokens_in ?? 0;
    entry.tokensOut += row.tokens_out ?? 0;
    byModelMap.set(row.model_used, entry);
  }

  const byModel = Array.from(byModelMap.entries()).map(([model, { tokensIn, tokensOut }]) => ({
    model,
    tokensIn,
    tokensOut,
    costUsd: estimateCostUsd(model, tokensIn, tokensOut),
  }));

  const crmAiUsd = (crmUsageResult.data ?? []).reduce(
    (sum, row: { cost_usd: number | null }) => sum + (row.cost_usd ?? 0),
    0,
  );
  const chatUsd = byModel.reduce((sum, m) => sum + m.costUsd, 0);

  return { spentUsd: chatUsd + crmAiUsd, byModel, crmAiUsd };
}
