import Link from "next/link";

import { StatusChip } from "@/components/admin/crm/ui";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getContracts, isMissingTableError, type Contract } from "@/lib/admin/crm-docs";
import { canEditCrm } from "@/lib/admin/crm-page";
import { getAdminLocale, getAdminTranslator } from "@/lib/admin/i18n/server";
import { formatMoney } from "@/lib/crm/format";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Contracts · Admin" };

export default async function AdminContractsPage() {
  const t = await getAdminTranslator("contracts");
  const tc = await getAdminTranslator("crmDocs");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={tc("notConfiguredTitle")} body={tc("notConfiguredBody")} />;
  }

  let contracts: Contract[];
  try {
    contracts = await getContracts();
  } catch (err) {
    if (isMissingTableError(err)) return <EmptyState title={tc("tableMissingTitle")} body={tc("tableMissingBody")} />;
    throw err;
  }
  const [locale, canEdit] = await Promise.all([getAdminLocale(), canEditCrm()]);

  const columns: Column<Contract>[] = [
    {
      header: t("columnNo"),
      cell: (row) => (
        <Link href={`/admin/contracts/${row.id}`} dir="ltr" className="font-mono text-xs font-semibold text-cobalt hover:underline">
          {row.contractNo}
        </Link>
      ),
    },
    {
      header: t("columnTitle"),
      cell: (row) => (
        <Link href={`/admin/contracts/${row.id}`} className="font-medium text-ink hover:underline" dir="auto">
          {row.title}
        </Link>
      ),
    },
    { header: t("columnClient"), cell: (row) => <span dir="auto">{row.clientCompany ? `${row.clientName} · ${row.clientCompany}` : row.clientName}</span> },
    { header: t("columnAmount"), numeric: true, cell: (row) => formatMoney(row.amountCents, row.currency, locale === "fa" ? "fa" : "en") },
    { header: t("columnStatus"), cell: (row) => <StatusChip status={row.status} label={tc(`status.${row.status}`)} /> },
    {
      header: t("columnUpdated"),
      numeric: true,
      cell: (row) => new Date(row.updatedAt).toLocaleString(locale === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow text-cobalt">{t("eyebrow")}</p>
          <h1 className="text-section mt-3 text-ink">{t("title")}</h1>
          <p className="mt-3 text-ink/70">{t("subtitle")}</p>
        </div>
        {canEdit ? (
          <Link href="/admin/contracts/new" className="rounded-full bg-cobalt px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cobalt-dark">
            {t("newButton")}
          </Link>
        ) : null}
      </div>
      <div className="mt-8">
        {contracts.length === 0 ? <EmptyState title={t("emptyTitle")} body={t("emptyBody")} /> : <DataTable columns={columns} rows={contracts} />}
      </div>
    </div>
  );
}
