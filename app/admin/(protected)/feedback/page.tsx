import Link from "next/link";

import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getFeedback, type FeedbackRow } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Feedback · Admin" };

const columns: Column<FeedbackRow>[] = [
  {
    header: "Rating",
    cell: (row) => (
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          row.rating === 1 ? "bg-mint text-emerald" : "bg-saffron/20 text-saffron-deep"
        }`}
      >
        {row.rating === 1 ? "Good" : "Bad"}
      </span>
    ),
  },
  { header: "Reply", cell: (row) => <span className="line-clamp-2 max-w-md">{row.messageContent}</span> },
  { header: "Comment", cell: (row) => row.comment ?? "—" },
  {
    header: "Conversation",
    cell: (row) =>
      row.conversationId ? (
        <Link href={`/admin/conversations/${row.conversationId}`} className="text-emerald hover:underline">
          View →
        </Link>
      ) : (
        "—"
      ),
  },
  {
    header: "Given",
    numeric: true,
    cell: (row) => new Date(row.createdAt).toLocaleString(),
  },
];

export default async function AdminFeedbackPage() {
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to see feedback here."
      />
    );
  }

  const feedback = await getFeedback();

  return (
    <div>
      <p className="label-eyebrow text-emerald">Quality</p>
      <h1 className="text-section mt-3 text-forest">Feedback</h1>
      <p className="mt-3 text-ink/70">
        Thumbs up/down from the web and widget chat UIs. (Telegram doesn't have a feedback
        mechanism yet.)
      </p>

      <div className="mt-8">
        {feedback.length === 0 ? (
          <EmptyState title="No feedback yet" body="Ratings will appear here as visitors rate replies." />
        ) : (
          <DataTable columns={columns} rows={feedback} />
        )}
      </div>
    </div>
  );
}
