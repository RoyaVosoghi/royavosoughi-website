import { ChannelBreakdownChart } from "@/components/admin/DashboardCharts";
import { EmptyState } from "@/components/admin/EmptyState";
import { LeadFunnelChart, MonthlyRevenueChart, PipelineValueChart } from "@/components/admin/CrmReportCharts";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import {
  getLeadFunnelStats,
  getLeadSourceBreakdown,
  getPipelineValueByStage,
  getRevenueByMonthJalaali,
} from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Reports · Admin" };

export default async function AdminCrmReportsPage() {
  const t = await getAdminTranslator("reports");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const [funnel, pipelineValue, revenue, leadSource] = await Promise.all([
    getLeadFunnelStats(),
    getPipelineValueByStage(),
    getRevenueByMonthJalaali(),
    getLeadSourceBreakdown(),
  ]);

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
          <h2 className="font-display text-lg font-bold text-forest">{t("funnelTitle")}</h2>
          <div className="mt-4">
            <LeadFunnelChart stats={funnel} />
          </div>
        </section>

        <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
          <h2 className="font-display text-lg font-bold text-forest">{t("pipelineValueTitle")}</h2>
          <div className="mt-4">
            <PipelineValueChart stages={pipelineValue} noDataLabel={t("noData")} />
          </div>
        </section>

        <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
          <h2 className="font-display text-lg font-bold text-forest">{t("revenueTitle")}</h2>
          <p className="text-sm text-ink/50">{t("revenueSubtitle")}</p>
          <div className="mt-4">
            <MonthlyRevenueChart months={revenue} noDataLabel={t("noData")} />
          </div>
        </section>

        <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
          <h2 className="font-display text-lg font-bold text-forest">{t("leadSourceTitle")}</h2>
          <div className="mt-4">
            <ChannelBreakdownChart sessionsByChannel={leadSource} />
          </div>
        </section>
      </div>
    </div>
  );
}
