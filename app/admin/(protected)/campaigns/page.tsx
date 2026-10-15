import Link from "next/link";

import { CampaignCreateForm } from "@/components/admin/crm/CampaignCreateForm";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getCampaigns, isMissingTableError, type Campaign } from "@/lib/admin/crm-docs";
import { canEditCrm } from "@/lib/admin/crm-page";
import { getAdminLocale, getAdminTranslator } from "@/lib/admin/i18n/server";
import { isSegmentKey } from "@/lib/crm/segments";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Campaigns · Admin" };

export default async function AdminCampaignsPage() {
  const t = await getAdminTranslator("campaigns");
  const tc = await getAdminTranslator("crmDocs");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={tc("notConfiguredTitle")} body={tc("notConfiguredBody")} />;
  }

  let campaigns: Campaign[];
  try {
    campaigns = await getCampaigns();
  } catch (err) {
    if (isMissingTableError(err)) return <EmptyState title={tc("tableMissingTitle")} body={tc("tableMissingBody")} />;
    throw err;
  }
  const [locale, canEdit] = await Promise.all([getAdminLocale(), canEditCrm()]);

  const columns: Column<Campaign>[] = [
    {
      header: t("columnName"),
      cell: (row) => (
        <Link href={`/admin/campaigns/${row.id}`} className="font-medium text-ink hover:underline" dir="auto">
          {row.name}
        </Link>
      ),
    },
    { header: t("columnAudience"), cell: (row) => (isSegmentKey(row.segmentKey) ? t(`segments.${row.segmentKey}`) : row.segmentKey) },
    {
      header: t("columnProgress"),
      numeric: true,
      cell: (row) => {
        const total = Object.values(row.counts).reduce((a, b) => a + b, 0);
        return `${row.counts.ready + row.counts.sent} / ${row.counts.sent} · ${total}`;
      },
    },
    {
      header: t("columnCreated"),
      numeric: true,
      cell: (row) => new Date(row.createdAt).toLocaleDateString(locale === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium" }),
    },
  ];

  return (
    <div>
      <p className="label-eyebrow text-cobalt">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-ink">{t("title")}</h1>
      <p className="mt-3 max-w-3xl text-ink/70">{t("subtitle")}</p>
      <div className="mt-8 flex flex-col gap-6">
        {canEdit ? <CampaignCreateForm /> : null}
        {campaigns.length === 0 ? <EmptyState title={t("emptyTitle")} body={t("emptyBody")} /> : <DataTable columns={columns} rows={campaigns} />}
      </div>
    </div>
  );
}
