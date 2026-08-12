import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getRegistrations, type Registration } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Registrations · Admin" };

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-mint text-emerald",
  pending: "bg-saffron/20 text-saffron-deep",
  cancelled: "bg-forest/10 text-ink/60",
};

function buildColumns(
  t: Awaited<ReturnType<typeof getAdminTranslator<"registrations">>>,
): Column<Registration>[] {
  const STATUS_LABELS: Record<string, string> = {
    confirmed: t("statusConfirmed"),
    pending: t("statusPending"),
    cancelled: t("statusCancelled"),
  };

  return [
    { header: t("columnName"), cell: (row) => row.name },
    { header: t("columnEmail"), cell: (row) => <a className="text-emerald hover:underline" href={`mailto:${row.email}`}>{row.email}</a> },
    { header: t("columnEvent"), cell: (row) => row.eventType.replace("_", " ") },
    {
      header: t("columnStatus"),
      cell: (row) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
            STATUS_STYLES[row.status] ?? "bg-forest/10 text-ink/60"
          }`}
        >
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      ),
    },
    {
      header: t("columnRegistered"),
      numeric: true,
      cell: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];
}

export default async function AdminRegistrationsPage() {
  const t = await getAdminTranslator("registrations");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const registrations = await getRegistrations();
  const columns = buildColumns(t);

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8">
        {registrations.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={registrations} />
        )}
      </div>
    </div>
  );
}
