import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Singleton row (id=1) — embeddable widget appearance + domain allowlist,
 * editable from /admin/settings. Read via the public app/api/widget/config
 * route (safe to expose: no secrets, just cosmetics + the allowlist itself),
 * and enforced against `Origin` in every other app/api/widget/* route.
 */
export interface WidgetConfig {
  primaryColor: string;
  position: "bottom-end" | "bottom-start";
  welcomeMessageEn: string | null;
  welcomeMessageFa: string | null;
  allowedDomains: string[];
}

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  primaryColor: "#0f7b4f",
  position: "bottom-end",
  welcomeMessageEn: null,
  welcomeMessageFa: null,
  allowedDomains: [],
};

const CACHE_TTL_MS = 60_000;
let cached: { value: WidgetConfig; expiresAt: number } | null = null;

export async function getWidgetConfig(): Promise<WidgetConfig> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return DEFAULT_WIDGET_CONFIG;

  const { data, error } = await supabase
    .from("widget_config")
    .select("primary_color, position, welcome_message_en, welcome_message_fa, allowed_domains")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[widget-config] fetch failed:", error.message);
    return DEFAULT_WIDGET_CONFIG;
  }

  const value: WidgetConfig = {
    primaryColor: data.primary_color,
    position: data.position,
    welcomeMessageEn: data.welcome_message_en,
    welcomeMessageFa: data.welcome_message_fa,
    allowedDomains: data.allowed_domains ?? [],
  };
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export interface WidgetConfigUpdate {
  primaryColor?: string;
  position?: "bottom-end" | "bottom-start";
  welcomeMessageEn?: string | null;
  welcomeMessageFa?: string | null;
  allowedDomains?: string[];
}

export async function updateWidgetConfig(update: WidgetConfigUpdate): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.primaryColor !== undefined) patch.primary_color = update.primaryColor;
  if (update.position !== undefined) patch.position = update.position;
  if (update.welcomeMessageEn !== undefined) patch.welcome_message_en = update.welcomeMessageEn;
  if (update.welcomeMessageFa !== undefined) patch.welcome_message_fa = update.welcomeMessageFa;
  if (update.allowedDomains !== undefined) patch.allowed_domains = update.allowedDomains;

  const { error } = await supabase.from("widget_config").update(patch).eq("id", 1);
  if (error) throw error;

  cached = null;
}

/** Origin check for every app/api/widget/* route. Empty allowlist = allow everything (today's default, zero-config behavior). */
export function isOriginAllowed(origin: string | null, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname;
    return allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** CORS headers for a request already checked with isOriginAllowed. With no allowlist configured, stays wildcard (today's behavior); once one exists, echoes back the specific caller's origin instead of "*". */
export function widgetCorsHeaders(origin: string | null, allowedDomains: string[]): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedDomains.length === 0 ? "*" : (origin ?? "*"),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
