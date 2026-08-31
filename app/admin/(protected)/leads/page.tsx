import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { LeadAiScore } from "@/components/admin/LeadAiScore";
import { LeadConvertButton } from "@/components/admin/LeadConvertButton";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { ScoreUnscoredLeadsButton } from "@/components/admin/ScoreUnscoredLeadsButton";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getLeads, type Lead } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Leads · Admin" };

function buildColumns(
  t: Awaited<ReturnType<typeof getAdminTranslator<"leads">>>,
): Column<Lead>[] {
  return [
    { header: t("columnName"), cell: (row) => row.name },
    { header: t("columnEmail"), cell: (row) => <a className="text-emerald hover:underline" href={`mailto:${row.email}`}>{row.email}</a> },
    { header: t("columnInterest"), cell: (row) => row.interest ?? "—" },
    { header: t("columnSource"), cell: (row) => row.source ?? "—" },
    { header: t("columnStatus"), cell: (row) => <LeadStatusSelect id={row.id} status={row.status} /> },
    { header: t("columnAiScore"), cell: (row) => <LeadAiScore id={row.id} score={row.aiScore} reason={row.aiScoreReason} /> },
    {
      header: t("columnActions"),
      cell: (row) =>
        row.status === "converted" ? null : <LeadConvertButton id={row.id} companyName={row.companyName} />,
    },
    {
      header: t("columnCaptured"),
      numeric: true,
      cell: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];
}

export default async function AdminLeadsPage() {
  const t = await getAdminTranslator("leads");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const leads = await getLeads();
  const columns = buildColumns(t);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
          <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
          <p className="mt-3 text-ink/70">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ScoreUnscoredLeadsButton />
          <a
            href="/api/admin/leads/export"
            className="rounded-full border-2 border-forest/20 px-5 py-2 text-sm font-semibold text-forest transition-colors hover:bg-mint/40"
          >
            {t("exportCsv")}
          </a>
        </div>
      </div>

      <div className="mt-8">
        {leads.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={leads} />
        )}
      </div>
    </div>
  );
}
