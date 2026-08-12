import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getMonthlySpend } from "@/lib/ai/budget";

export interface AnalyticsSnapshot {
  days: number;
  conversationsCount: number;
  uniqueUsersCount: number;
  messagesCount: number;
  leadsCount: number;
  /** leads captured in-window / conversations started in-window. */
  conversionRatePct: number;
  avgMessagesPerConversation: number;
  avgConversationMinutes: number;
  /** positive feedback / (positive + negative), in-window. */
  satisfactionRatePct: number;
  feedbackCount: number;
  sessionsByChannel: Record<string, number>;
  topTopics: Array<{ title: string; count: number }>;
  monthlySpendUsd: number;
  byModel: Array<{ model: string; tokensIn: number; tokensOut: number; costUsd: number }>;
}

export async function getAnalytics(days = 30): Promise<AnalyticsSnapshot> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      days,
      conversationsCount: 0,
      uniqueUsersCount: 0,
      messagesCount: 0,
      leadsCount: 0,
      conversionRatePct: 0,
      avgMessagesPerConversation: 0,
      avgConversationMinutes: 0,
      satisfactionRatePct: 0,
      feedbackCount: 0,
      sessionsByChannel: { web: 0, telegram: 0, widget: 0 },
      topTopics: [],
      monthlySpendUsd: 0,
      byModel: [],
    };
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [conversations, leads, feedback, spend] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, channel, external_user_id, started_at, last_active_at")
      .gte("started_at", since),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("feedback").select("rating").gte("created_at", since),
    getMonthlySpend(),
  ]);

  const convoRows = (conversations.data ?? []) as Array<{
    id: string;
    channel: string;
    external_user_id: string;
    started_at: string;
    last_active_at: string;
  }>;

  const sessionsByChannel: Record<string, number> = { web: 0, telegram: 0, widget: 0 };
  const uniqueUsers = new Set<string>();
  let totalMinutes = 0;
  for (const c of convoRows) {
    sessionsByChannel[c.channel] = (sessionsByChannel[c.channel] ?? 0) + 1;
    uniqueUsers.add(`${c.channel}:${c.external_user_id}`);
    const started = new Date(c.started_at).getTime();
    const lastActive = new Date(c.last_active_at).getTime();
    if (Number.isFinite(started) && Number.isFinite(lastActive) && lastActive > started) {
      totalMinutes += (lastActive - started) / 60_000;
    }
  }

  const conversationIds = convoRows.map((c) => c.id);
  let messagesCount = 0;
  let avgMessagesPerConversation = 0;
  const topicCounts = new Map<string, number>();

  if (conversationIds.length > 0) {
    const { data: messages } = await supabase
      .from("messages")
      .select("id, conversation_id, retrieved_chunk_ids")
      .in("conversation_id", conversationIds)
      .in("role", ["user", "assistant"]);

    const msgRows = (messages ?? []) as Array<{ id: string; conversation_id: string; retrieved_chunk_ids: string[] | null }>;
    messagesCount = msgRows.length;
    avgMessagesPerConversation = conversationIds.length ? messagesCount / conversationIds.length : 0;

    const chunkIds = Array.from(
      new Set(msgRows.flatMap((m) => m.retrieved_chunk_ids ?? []).filter(Boolean)),
    );

    if (chunkIds.length > 0) {
      const { data: chunkRows } = await supabase
        .from("chunks")
        .select("id, documents(title)")
        .in("id", chunkIds);

      const chunkToTitle = new Map<string, string>();
      for (const row of (chunkRows ?? []) as Array<{ id: string; documents: { title: string } | { title: string }[] | null }>) {
        const doc = Array.isArray(row.documents) ? row.documents[0] : row.documents;
        if (doc?.title) chunkToTitle.set(row.id, doc.title);
      }

      for (const m of msgRows) {
        for (const chunkId of m.retrieved_chunk_ids ?? []) {
          const title = chunkToTitle.get(chunkId);
          if (!title) continue;
          topicCounts.set(title, (topicCounts.get(title) ?? 0) + 1);
        }
      }
    }
  }

  const topTopics = Array.from(topicCounts.entries())
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const feedbackRows = (feedback.data ?? []) as Array<{ rating: number }>;
  const positive = feedbackRows.filter((f) => f.rating > 0).length;
  const satisfactionRatePct = feedbackRows.length ? (positive / feedbackRows.length) * 100 : 0;

  return {
    days,
    conversationsCount: convoRows.length,
    uniqueUsersCount: uniqueUsers.size,
    messagesCount,
    leadsCount: leads.count ?? 0,
    conversionRatePct: convoRows.length ? ((leads.count ?? 0) / convoRows.length) * 100 : 0,
    avgMessagesPerConversation,
    avgConversationMinutes: convoRows.length ? totalMinutes / convoRows.length : 0,
    satisfactionRatePct,
    feedbackCount: feedbackRows.length,
    sessionsByChannel,
    topTopics,
    monthlySpendUsd: spend.spentUsd,
    byModel: spend.byModel,
  };
}
