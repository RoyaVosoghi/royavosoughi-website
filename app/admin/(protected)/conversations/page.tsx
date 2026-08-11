import Link from "next/link";

import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getSessions, type ChatSessionSummary } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Conversations · Admin" };

const CHANNEL_STYLES: Record<string, string> = {
  web: "bg-mint text-emerald",
  widget: "bg-spring/20 text-emerald",
  telegram: "bg-forest/10 text-forest",
};

const columns: Column<ChatSessionSummary>[] = [
  {
    header: "Channel",
    cell: (row) => (
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
          CHANNEL_STYLES[row.channel] ?? "bg-forest/10 text-ink/60"
        }`}
      >
        {row.channel}
      </span>
    ),
  },
  { header: "Lead email", cell: (row) => row.leadEmail ?? "—" },
  { header: "Locale", cell: (row) => row.locale.toUpperCase() },
  {
    header: "Last active",
    numeric: true,
    cell: (row) => new Date(row.lastActiveAt).toLocaleString(),
  },
  {
    header: "",
    cell: (row) => (
      <Link href={`/admin/conversations/${row.id}`} className="font-medium text-emerald hover:underline">
        View →
      </Link>
    ),
  },
];

export default async function AdminConversationsPage() {
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to see conversations here."
      />
    );
  }

  const sessions = await getSessions();

  return (
    <div>
      <p className="label-eyebrow text-emerald">The brain</p>
      <h1 className="text-section mt-3 text-forest">Conversations</h1>
      <p className="mt-3 text-ink/70">Every session across web, the embeddable widget, and Telegram.</p>

      <div className="mt-8">
        {sessions.length === 0 ? (
          <EmptyState title="No conversations yet" body="They'll appear here as soon as a visitor chats." />
        ) : (
          <DataTable columns={columns} rows={sessions} />
        )}
      </div>
    </div>
  );
}
