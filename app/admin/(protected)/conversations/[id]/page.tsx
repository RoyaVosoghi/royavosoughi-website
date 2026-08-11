import Link from "next/link";
import { notFound } from "next/navigation";

import { ConversationStatusButton } from "@/components/admin/ConversationStatusButton";
import { EmptyState } from "@/components/admin/EmptyState";
import { getConversation, getConversationMessages } from "@/lib/admin/queries";
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
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to see this conversation."
      />
    );
  }

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const messages = await getConversationMessages(id);

  return (
    <div>
      <Link href="/admin/conversations" className="text-sm font-medium text-emerald hover:underline">
        ← All conversations
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-forest capitalize">
            {conversation.channel} conversation
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {conversation.leadEmail ?? "Anonymous"} · {conversation.locale.toUpperCase()} · started{" "}
            {new Date(conversation.startedAt).toLocaleString()}
          </p>
        </div>
        <ConversationStatusButton id={conversation.id} status={conversation.status} />
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
        {messages.length === 0 ? (
          <p className="text-ink/60">No messages recorded.</p>
        ) : (
          messages.map((message) => (
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
