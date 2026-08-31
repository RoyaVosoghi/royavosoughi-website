import Link from "next/link";

import { AddCompanyForm } from "@/components/admin/AddCompanyForm";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getCompanies, type Company } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Companies · Admin" };

function buildColumns(t: Awaited<ReturnType<typeof getAdminTranslator<"companies">>>): Column<Company>[] {
  return [
    {
      header: t("columnName"),
      cell: (row) => (
        <Link href={`/admin/companies/${row.id}`} className="font-medium text-forest hover:underline">
          {row.name}
        </Link>
      ),
    },
    { header: t("columnDomain"), cell: (row) => row.domain ?? "—" },
    { header: t("columnIndustry"), cell: (row) => row.industry ?? "—" },
    {
      header: t("columnCreated"),
      numeric: true,
      cell: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];
}

export default async function AdminCompaniesPage() {
  const t = await getAdminTranslator("companies");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const companies = await getCompanies();
  const columns = buildColumns(t);

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8 flex flex-col gap-6">
        <AddCompanyForm />
        {companies.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={companies} />
        )}
      </div>
    </div>
  );
}
