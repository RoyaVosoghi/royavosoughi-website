import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getUnifiedUsers, type UnifiedUser } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Users · Admin" };

const columns: Column<UnifiedUser>[] = [
  { header: "Name", cell: (row) => row.name ?? "—" },
  { header: "Channel", cell: (row) => <span className="capitalize">{row.channel}</span> },
  { header: "Identifier", cell: (row) => <span className="font-mono text-xs">{row.externalId}</span> },
  {
    header: "First seen",
    numeric: true,
    cell: (row) => new Date(row.firstSeen).toLocaleString(),
  },
];

export default async function AdminUsersPage() {
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to see visitors here."
      />
    );
  }

  const users = await getUnifiedUsers();

  return (
    <div>
      <p className="label-eyebrow text-emerald">Identity</p>
      <h1 className="text-section mt-3 text-forest">Users</h1>
      <p className="mt-3 text-ink/70">
        One row per identity seen across web, widget, and Telegram — names fill in once a visitor
        is captured as a lead.
      </p>

      <div className="mt-8">
        {users.length === 0 ? (
          <EmptyState title="No visitors yet" body="They'll show up here the moment someone opens the chat." />
        ) : (
          <DataTable columns={columns} rows={users} />
        )}
      </div>
    </div>
  );
}
