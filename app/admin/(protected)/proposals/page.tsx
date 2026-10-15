import Link from "next/link";

import { StatusChip } from "@/components/admin/crm/ui";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getProposals, isMissingTableError, type Proposal } from "@/lib/admin/crm-docs";
import { canEditCrm } from "@/lib/admin/crm-page";
import { getAdminLocale, getAdminTranslator } from "@/lib/admin/i18n/server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Proposals · Admin" };

export default async function AdminProposalsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const t = await getAdminTranslator("proposals");
  const tc = await getAdminTranslator("crmDocs");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={tc("notConfiguredTitle")} body={tc("notConfiguredBody")} />;
  }

  const { filter } = await searchParams;
  const needsAction = filter === "action";

  let proposals: Proposal[];
  try {
    proposals = await getProposals({ needsAction });
  } catch (err) {
    if (isMissingTableError(err)) return <EmptyState title={tc("tableMissingTitle")} body={tc("tableMissingBody")} />;
    throw err;
  }
  const [locale, canEdit] = await Promise.all([getAdminLocale(), canEditCrm()]);

  const columns: Column<Proposal>[] = [
    {
      header: t("columnNo"),
      cell: (row) => (
        <Link href={`/admin/proposals/${row.id}`} dir="ltr" className="font-mono text-xs font-semibold text-cobalt hover:underline">
          {row.proposalNo}
        </Link>
      ),
    },
    {
      header: t("columnTitle"),
      cell: (row) => (
        <Link href={`/admin/proposals/${row.id}`} className="font-medium text-ink hover:underline" dir="auto">
          {row.title}
        </Link>
      ),
    },
    { header: t("columnClient"), cell: (row) => <span dir="auto">{row.clientCompany ? `${row.clientName} · ${row.clientCompany}` : row.clientName}</span> },
    { header: t("columnStatus"), cell: (row) => <StatusChip status={row.status} label={tc(`status.${row.status}`)} /> },
    { header: t("columnViews"), numeric: true, cell: (row) => row.viewCount.toLocaleString(locale === "fa" ? "fa-IR" : "en-US") },
    {
      header: t("columnUpdated"),
      numeric: true,
      cell: (row) => new Date(row.updatedAt).toLocaleString(locale === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }),
    },
  ];

  const tab = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-cobalt text-white" : "text-ink/60 hover:bg-ink/10"}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow text-cobalt">{t("eyebrow")}</p>
          <h1 className="text-section mt-3 text-ink">{t("title")}</h1>
          <p className="mt-3 text-ink/70">{t("subtitle")}</p>
        </div>
        {canEdit ? (
          <Link href="/admin/proposals/new" className="rounded-full bg-cobalt px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cobalt-dark">
            {t("newButton")}
          </Link>
        ) : null}
      </div>

      <div className="mt-6 inline-flex gap-1 rounded-full bg-ink/5 p-1">
        <Link href="/admin/proposals" className={tab(!needsAction)}>
          {t("filterAll")}
        </Link>
        <Link href="/admin/proposals?filter=action" className={tab(needsAction)}>
          {t("filterNeedsAction")}
        </Link>
      </div>

      <div className="mt-6">
        {proposals.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={needsAction ? t("emptyNeedsAction") : t("emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={proposals} />
        )}
      </div>
    </div>
  );
}
