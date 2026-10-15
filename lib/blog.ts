import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Blog posts — one row per language (an EN post and its FA version share a
 * slug by convention, not by a foreign key, so either can exist alone).
 * Public pages only ever see status = 'published'.
 */

export type BlogLocale = "en" | "fa";
export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  locale: BlogLocale;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  tags: string[];
  status: BlogStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const COLUMNS = "id, locale, slug, title, excerpt, body_md, tags, status, published_at, created_at, updated_at";

function toPost(row: Record<string, unknown>): BlogPost {
  return {
    id: row.id as string,
    locale: row.locale as BlogLocale,
    slug: row.slug as string,
    title: row.title as string,
    excerpt: (row.excerpt as string) ?? "",
    bodyMd: (row.body_md as string) ?? "",
    tags: (row.tags as string[]) ?? [],
    status: row.status as BlogStatus,
    publishedAt: (row.published_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function requireClient() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");
  return supabase;
}

/** Public list. Never throws — a missing table or unconfigured Supabase just means "no posts yet". */
export async function listPublishedPosts(locale?: BlogLocale, limit = 100): Promise<BlogPost[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  let query = supabase.from("blog_posts").select(COLUMNS).eq("status", "published");
  if (locale) query = query.eq("locale", locale);
  const { data, error } = await query.order("published_at", { ascending: false }).limit(limit);
  if (error) {
    console.error("[blog] listPublishedPosts failed:", error.message);
    return [];
  }
  return (data ?? []).map(toPost);
}

export async function getPublishedPost(locale: BlogLocale, slug: string): Promise<BlogPost | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("blog_posts")
    .select(COLUMNS)
    .eq("locale", locale)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    console.error("[blog] getPublishedPost failed:", error.message);
    return null;
  }
  return data ? toPost(data) : null;
}

/** Whether the other language has a published version of this slug — for the language switcher / hreflang. */
export async function getPublishedLocalesForSlug(slug: string): Promise<BlogLocale[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const { data } = await supabase.from("blog_posts").select("locale").eq("slug", slug).eq("status", "published");
  return (data ?? []).map((r) => r.locale as BlogLocale);
}

// --- Admin ------------------------------------------------------------------

export async function getAllPosts(): Promise<BlogPost[]> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("blog_posts").select(COLUMNS).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toPost);
}

export async function getPost(id: string): Promise<BlogPost | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("blog_posts").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toPost(data) : null;
}

export interface BlogPostInput {
  locale: BlogLocale;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  tags: string[];
  status: BlogStatus;
}

/** Publishing stamps published_at the first time only — re-saving a published post keeps its original date. */
function toRow(input: BlogPostInput, current: BlogPost | null) {
  return {
    locale: input.locale,
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    body_md: input.bodyMd,
    tags: input.tags,
    status: input.status,
    published_at: input.status === "published" ? (current?.publishedAt ?? new Date().toISOString()) : current?.publishedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function createPost(input: BlogPostInput, adminId: string | null): Promise<BlogPost> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("blog_posts").insert({ ...toRow(input, null), created_by: adminId }).select(COLUMNS).single();
  if (error) throw error;
  return toPost(data);
}

export async function updatePost(id: string, input: BlogPostInput): Promise<BlogPost | null> {
  const supabase = requireClient();
  const current = await getPost(id);
  if (!current) return null;
  const { data, error } = await supabase.from("blog_posts").update(toRow(input, current)).eq("id", id).select(COLUMNS).single();
  if (error) throw error;
  return toPost(data);
}

export async function deletePost(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw error;
}

/** Persian (Jalaali) calendar for fa, day-month-year for en. */
export function formatPostDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/** Rough reading time — ~200 words/min for English, similar for Persian. */
export function readingMinutes(md: string): number {
  return Math.max(1, Math.round(md.split(/\s+/).filter(Boolean).length / 200));
}
