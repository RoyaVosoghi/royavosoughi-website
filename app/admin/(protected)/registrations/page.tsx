import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getRegistrations, type Registration } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Registrations · Admin" };

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-mint text-emerald",
  pending: "bg-saffron/20 text-saffron-deep",
  cancelled: "bg-forest/10 text-ink/60",
};

const columns: Column<Registration>[] = [
  { header: "Name", cell: (row) => row.name },
  { header: "Email", cell: (row) => <a className="text-emerald hover:underline" href={`mailto:${row.email}`}>{row.email}</a> },
  { header: "Event", cell: (row) => row.eventType.replace("_", " ") },
  {
    header: "Status",
    cell: (row) => (
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
          STATUS_STYLES[row.status] ?? "bg-forest/10 text-ink/60"
        }`}
      >
        {row.status}
      </span>
    ),
  },
  {
    header: "Registered",
    numeric: true,
    cell: (row) => new Date(row.createdAt).toLocaleString(),
  },
];

export default async function AdminRegistrationsPage() {
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to see registrations here."
      />
    );
  }

  const registrations = await getRegistrations();

  return (
    <div>
      <p className="label-eyebrow text-emerald">Events</p>
      <h1 className="text-section mt-3 text-forest">Registrations</h1>
      <p className="mt-3 text-ink/70">Webinar and class sign-ups captured via the chatbot.</p>

      <div className="mt-8">
        {registrations.length === 0 ? (
          <EmptyState
            title="No registrations yet"
            body="No event catalog is live yet — this fills in once webinars go live."
          />
        ) : (
          <DataTable columns={columns} rows={registrations} />
        )}
      </div>
    </div>
  );
}
