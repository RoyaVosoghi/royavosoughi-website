import Link from "next/link";

import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { ResolveHandoffButton } from "@/components/admin/ResolveHandoffButton";
import { getHandoffRequests, type HandoffRequest } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Handoffs · Admin" };

const REASON_LABELS: Record<string, string> = {
  out_of_scope: "Out of scope",
  user_requested: "Asked for a human",
  other: "Other",
};

const columns: Column<HandoffRequest>[] = [
  { header: "Reason", cell: (row) => REASON_LABELS[row.reason] ?? row.reason },
  { header: "Note", cell: (row) => row.note ?? "—" },
  { header: "Locale", cell: (row) => row.locale.toUpperCase() },
  {
    header: "Conversation",
    cell: (row) =>
      row.sessionId ? (
        <Link href={`/admin/conversations/${row.sessionId}`} className="text-emerald hover:underline">
          View →
        </Link>
      ) : (
        "—"
      ),
  },
  {
    header: "Flagged",
    numeric: true,
    cell: (row) => new Date(row.createdAt).toLocaleString(),
  },
  {
    header: "",
    cell: (row) => <ResolveHandoffButton id={row.id} resolved={row.resolved} />,
  },
];

export default async function AdminHandoffsPage() {
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to see handoff requests here."
      />
    );
  }

  const handoffs = await getHandoffRequests();

  return (
    <div>
      <p className="label-eyebrow text-emerald">The brain</p>
      <h1 className="text-section mt-3 text-forest">Handoffs</h1>
      <p className="mt-3 text-ink/70">
        Flagged by the chatbot's request_human_handoff tool — out-of-scope questions or a visitor
        asking to talk to you directly.
      </p>

      <div className="mt-8">
        {handoffs.length === 0 ? (
          <EmptyState title="Nothing flagged" body="The bot hasn't needed to hand anyone off yet." />
        ) : (
          <DataTable columns={columns} rows={handoffs} />
        )}
      </div>
    </div>
  );
}
