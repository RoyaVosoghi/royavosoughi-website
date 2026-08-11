import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getLeads, type Lead } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Leads · Admin" };

const columns: Column<Lead>[] = [
  { header: "Name", cell: (row) => row.name },
  { header: "Email", cell: (row) => <a className="text-emerald hover:underline" href={`mailto:${row.email}`}>{row.email}</a> },
  { header: "Interest", cell: (row) => row.interest ?? "—" },
  { header: "Source", cell: (row) => row.source ?? "—" },
  { header: "Locale", cell: (row) => row.locale.toUpperCase() },
  {
    header: "Captured",
    numeric: true,
    cell: (row) => new Date(row.createdAt).toLocaleString(),
  },
];

export default async function AdminLeadsPage() {
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to see leads here."
      />
    );
  }

  const leads = await getLeads();

  return (
    <div>
      <p className="label-eyebrow text-emerald">CRM</p>
      <h1 className="text-section mt-3 text-forest">Leads</h1>
      <p className="mt-3 text-ink/70">Captured by the chatbot's capture_lead tool, across every channel.</p>

      <div className="mt-8">
        {leads.length === 0 ? (
          <EmptyState title="No leads yet" body="They'll show up here the moment the chatbot captures one." />
        ) : (
          <DataTable columns={columns} rows={leads} />
        )}
      </div>
    </div>
  );
}
