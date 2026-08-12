import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getAuditLog, type AuditLogRow } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Audit log · Admin" };

export default async function AdminAuditLogPage() {
  const t = await getAdminTranslator("auditLog");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const entries = await getAuditLog();

  const columns: Column<AuditLogRow>[] = [
    { header: t("colAction"), cell: (row) => <span className="font-mono text-xs">{row.action}</span> },
    { header: t("colTarget"), cell: (row) => row.target ?? "—" },
    { header: t("colAdmin"), cell: (row) => row.adminEmail ?? "—" },
    {
      header: t("colWhen"),
      numeric: true,
      cell: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8">
        {entries.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={entries} />
        )}
      </div>
    </div>
  );
}
