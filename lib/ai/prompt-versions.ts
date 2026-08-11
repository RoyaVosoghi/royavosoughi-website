import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Locale } from "./types";

export interface PromptVersion {
  id: string;
  content: string;
  persona: Locale;
  isActive: boolean;
  createdAt: string;
}

const CACHE_TTL_MS = 60_000;
const activeCache = new Map<Locale, { value: string | null; expiresAt: number }>();

/** null means "no active version — the brain falls back to the hardcoded default in prompt.ts". */
export async function getActivePromptContent(locale: Locale): Promise<string | null> {
  const hit = activeCache.get(locale);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("prompt_versions")
    .select("content")
    .eq("persona", locale)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[prompt-versions] fetch failed:", error.message);
    return null;
  }

  const value = data?.content ?? null;
  activeCache.set(locale, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Deactivates whatever's currently active for the locale (if anything) and inserts+activates a new version — history is never deleted, just superseded. */
export async function createPromptVersion(
  locale: Locale,
  content: string,
  createdBy?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error: deactivateError } = await supabase
    .from("prompt_versions")
    .update({ is_active: false })
    .eq("persona", locale)
    .eq("is_active", true);
  if (deactivateError) throw deactivateError;

  const { error: insertError } = await supabase.from("prompt_versions").insert({
    content,
    persona: locale,
    is_active: true,
    created_by: createdBy ?? null,
  });
  if (insertError) throw insertError;

  activeCache.delete(locale);
}

/** Reverts a locale to the hardcoded default by deactivating whatever's active — doesn't delete history. */
export async function clearActivePromptVersion(locale: Locale): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("prompt_versions")
    .update({ is_active: false })
    .eq("persona", locale)
    .eq("is_active", true);
  if (error) throw error;

  activeCache.delete(locale);
}

export async function getPromptVersionHistory(limit = 50): Promise<PromptVersion[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("prompt_versions")
    .select("id, content, persona, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    content: row.content,
    persona: row.persona as Locale,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}
