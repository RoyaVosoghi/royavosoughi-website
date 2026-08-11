import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAuditLog, type AuditLogRow } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Audit log · Admin" };

const columns: Column<AuditLogRow>[] = [
  { header: "Action", cell: (row) => <span className="font-mono text-xs">{row.action}</span> },
  { header: "Target", cell: (row) => row.target ?? "—" },
  { header: "Admin", cell: (row) => row.adminEmail ?? "—" },
  {
    header: "When",
    numeric: true,
    cell: (row) => new Date(row.createdAt).toLocaleString(),
  },
];

export default async function AdminAuditLogPage() {
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to see the audit log here."
      />
    );
  }

  const entries = await getAuditLog();

  return (
    <div>
      <p className="label-eyebrow text-emerald">Trust</p>
      <h1 className="text-section mt-3 text-forest">Audit log</h1>
      <p className="mt-3 text-ink/70">
        Every settings change and handoff/conversation action taken from this panel. One admin
        account exists today, so every entry attributes to it regardless of who used the shared
        password.
      </p>

      <div className="mt-8">
        {entries.length === 0 ? (
          <EmptyState title="Nothing logged yet" body="Actions taken in this panel will appear here." />
        ) : (
          <DataTable columns={columns} rows={entries} />
        )}
      </div>
    </div>
  );
}
