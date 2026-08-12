import Link from "next/link";
import { notFound } from "next/navigation";

import { ConversationStatusButton } from "@/components/admin/ConversationStatusButton";
import { EmptyState } from "@/components/admin/EmptyState";
import { ManualReplyBox } from "@/components/admin/ManualReplyBox";
import { PauseBotButton } from "@/components/admin/PauseBotButton";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getConversation, getConversationMessages, getSourcesForChunkIds } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Conversation · Admin" };

const ROLE_STYLES: Record<string, string> = {
  user: "self-end bg-forest text-offwhite",
  assistant: "self-start bg-mint text-ink",
  tool: "self-start bg-saffron/15 text-saffron-deep font-mono text-xs",
};

export default async function AdminConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getAdminTranslator("conversations");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("detail.notConfiguredTitle")} body={t("detail.notConfiguredBody")} />;
  }

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const messages = await getConversationMessages(id);
  const allChunkIds = Array.from(new Set(messages.flatMap((m) => m.retrievedChunkIds ?? [])));
  const sources = await getSourcesForChunkIds(allChunkIds);

  return (
    <div>
      <Link href="/admin/conversations" className="text-sm font-medium text-emerald hover:underline">
        {t("detail.backLink")}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-forest capitalize">
            {t("detail.title", { channel: conversation.channel })}
            {conversation.botPaused ? (
              <span className="ms-2 rounded-full bg-saffron/20 px-2.5 py-0.5 text-xs font-semibold text-saffron-deep align-middle">
                {t("detail.pausedBadge")}
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {conversation.leadEmail ?? t("detail.anonymous")} · {conversation.locale.toUpperCase()} ·{" "}
            {t("detail.startedAt")} {new Date(conversation.startedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-3">
          <PauseBotButton id={conversation.id} paused={conversation.botPaused} />
          <ConversationStatusButton id={conversation.id} status={conversation.status} />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
        {messages.length === 0 ? (
          <p className="text-ink/60">{t("detail.noMessages")}</p>
        ) : (
          messages.map((message) => {
            const messageSources = (message.retrievedChunkIds ?? [])
              .map((cid) => sources.get(cid))
              .filter((s): s is NonNullable<typeof s> => Boolean(s));

            return (
              <div
                key={message.id}
                className={`flex max-w-[75%] flex-col rounded-2xl px-4 py-3 whitespace-pre-wrap ${
                  ROLE_STYLES[message.role] ?? "self-start bg-forest/5 text-ink"
                }`}
              >
                {message.toolName ? (
                  <p className="mb-1 text-[11px] font-bold tracking-wide uppercase opacity-70">
                    {message.toolName}
                  </p>
                ) : null}
                <p>{message.content}</p>
                <p className="mt-1 text-[11px] opacity-60">
                  {new Date(message.createdAt).toLocaleTimeString()}
                  {message.modelUsed ? ` · ${message.modelUsed}` : ""}
                  {message.tokensIn != null && message.tokensOut != null
                    ? ` · ${message.tokensIn}→${message.tokensOut} tokens`
                    : ""}
                </p>
                {messageSources.length > 0 ? (
                  <details className="mt-2 text-[11px] opacity-80">
                    <summary className="cursor-pointer font-semibold">
                      {t("detail.sourcesUsed", { count: messageSources.length })}
                    </summary>
                    <ul className="mt-1 flex flex-col gap-1">
                      {messageSources.map((s) => (
                        <li key={s.id}>
                          <span className="font-semibold">{s.documentTitle}:</span> {s.content.slice(0, 140)}
                          {s.content.length > 140 ? "…" : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <ManualReplyBox conversationId={conversation.id} paused={conversation.botPaused} />
    </div>
  );
}
