import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getUnifiedUsers, type UnifiedUser } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Identities · Admin" };

function buildColumns(
  t: Awaited<ReturnType<typeof getAdminTranslator<"identities">>>,
): Column<UnifiedUser>[] {
  return [
    { header: t("columnName"), cell: (row) => row.name ?? "—" },
    { header: t("columnChannel"), cell: (row) => <span className="capitalize">{row.channel}</span> },
    { header: t("columnIdentifier"), cell: (row) => <span className="font-mono text-xs">{row.externalId}</span> },
    {
      header: t("columnFirstSeen"),
      numeric: true,
      cell: (row) => new Date(row.firstSeen).toLocaleString(),
    },
  ];
}

export default async function AdminIdentitiesPage() {
  const t = await getAdminTranslator("identities");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const users = await getUnifiedUsers();
  const columns = buildColumns(t);

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8">
        {users.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={users} />
        )}
      </div>
    </div>
  );
}
