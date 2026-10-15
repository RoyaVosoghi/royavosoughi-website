import "server-only";

import { z } from "zod";

import { logAiUsage } from "@/lib/admin/queries";
import type { BlogPost } from "@/lib/blog";

import { estimateCostUsd } from "./model-catalog";
import { getOpenRouterClient, isOpenRouterConfigured } from "./providers/openrouter";

/**
 * Blog ↔ CRM link: for one lead, pick the published post most relevant to
 * their stated challenge and draft a short follow-up that shares it. The
 * model may only choose from the given post ids (validated), so it can never
 * link an article that doesn't exist.
 */
const MODEL = "google/gemini-2.5-flash";

const ResultSchema = z.object({ postId: z.string().min(1), message: z.string().min(20).max(1500) });

export type ContentSuggestion =
  | { ok: true; post: BlogPost; message: string }
  | { ok: false; error: "not_configured" | "no_credits" | "failed" };

export async function suggestContentForLead(
  lead: { name: string; interest: string | null; notes: string | null; locale: string },
  posts: BlogPost[],
): Promise<ContentSuggestion> {
  const client = getOpenRouterClient();
  if (!client || !isOpenRouterConfigured()) return { ok: false, error: "not_configured" };

  const fa = lead.locale === "fa";
  const system = `You help Roya Vosoughi, a solo AI engineer, follow up with a lead by sharing ONE of her blog articles.
Pick the article most relevant to the lead's challenge. Then write a short follow-up message (50–90 words) in ${fa ? "Persian (formal «شما»)" : "English"}: greet them by first name, connect their specific challenge to the article in one sentence, say what they'll get from it, and offer a free 30-minute call. No hype, no pressure, no URL (it is added automatically), sign off as Roya.
Respond with ONLY JSON: {"postId": "<id from the list>", "message": "..."}`;
  const user = [
    `Lead: ${lead.name}`,
    `Their challenge: ${lead.interest ?? "(not stated)"}`,
    lead.notes ? `Notes: ${lead.notes}` : "",
    "",
    "Articles:",
    ...posts.map((p) => `- id=${p.id} [${p.locale}] "${p.title}" — ${p.excerpt} (tags: ${p.tags.join(", ")})`),
  ]
    .filter((l) => l !== "")
    .join("\n");

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 2500,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const tokensIn = response.usage?.prompt_tokens ?? null;
      const tokensOut = response.usage?.completion_tokens ?? null;
      await logAiUsage("content_suggestion", tokensIn, tokensOut, tokensIn !== null && tokensOut !== null ? estimateCostUsd(MODEL, tokensIn, tokensOut) : null);

      const raw = (response.choices[0]?.message?.content ?? "").replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
      try {
        const parsed = ResultSchema.safeParse(JSON.parse(raw));
        const post = parsed.success ? posts.find((p) => p.id === parsed.data.postId) : undefined;
        if (parsed.success && post) return { ok: true, post, message: parsed.data.message.trim() };
      } catch {
        // fall through to the retry
      }
    }
    return { ok: false, error: "failed" };
  } catch (err) {
    console.error("[content-suggest] failed:", err);
    const status = err && typeof err === "object" && "status" in err ? (err as { status: unknown }).status : null;
    return { ok: false, error: status === 402 ? "no_credits" : "failed" };
  }
}
