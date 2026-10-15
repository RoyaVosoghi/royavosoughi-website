import Link from "next/link";

import { ChannelBreakdownChart, CostByModelChart } from "@/components/admin/DashboardCharts";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatCard } from "@/components/admin/StatCard";
import { getAdminLocale, getAdminTranslator } from "@/lib/admin/i18n/server";
import { getAnalytics } from "@/lib/admin/analytics";
import { getActivitiesWithContact, getDashboardStats } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Overview · Admin" };

const RANGE_OPTIONS = [7, 30, 90];

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const t = await getAdminTranslator("dashboard");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const { days: daysParam } = await searchParams;
  const days = RANGE_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 30;

  const [stats, analytics, overdue, tOverdue, locale] = await Promise.all([
    getDashboardStats(),
    getAnalytics(days),
    getActivitiesWithContact({ overdueOnly: true }, 6).catch(() => []),
    getAdminTranslator("crmOverdue"),
    getAdminLocale(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow text-cobalt">{t("eyebrow")}</p>
          <h1 className="text-section mt-3 text-ink">{t("title")}</h1>
        </div>
        <div className="flex gap-1 rounded-full bg-ink/5 p-1">
          {RANGE_OPTIONS.map((d) => (
            <Link
              key={d}
              href={`/admin?days=${d}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                days === d ? "bg-cobalt text-white" : "text-ink/60 hover:bg-ink/10"
              }`}
            >
              {d}
              {t("rangeSuffix")}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t("statConversations")} value={analytics.conversationsCount} hint={t("hintLastDays", { days })} />
        <StatCard label={t("statUniqueUsers")} value={analytics.uniqueUsersCount} hint={t("hintLastDays", { days })} />
        <StatCard label={t("statMessages")} value={analytics.messagesCount} hint={t("hintLastDays", { days })} />
        <StatCard
          label={t("statLeads")}
          value={analytics.leadsCount}
          hint={t("hintConversion", { pct: analytics.conversionRatePct.toFixed(1) })}
        />
        <StatCard label={t("statDocuments")} value={stats.documentsCount} hint={t("hintChunks", { count: stats.chunksCount })} />
        <StatCard label={t("statOpenHandoffs")} value={stats.openHandoffsCount} hint={t("hintAwaitingFollowUp")} />
      </div>

      <div className="mt-5 rounded-3xl border-2 border-ink/10 bg-canvas p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-ink">
            {tOverdue("title")}
            {overdue.length ? <span className="ms-2 rounded-full bg-amber/25 px-2.5 py-0.5 text-sm text-amber-deep">{overdue.length}</span> : null}
          </h2>
          <Link href="/admin/activities?overdue=1" className="text-sm font-medium text-cobalt hover:underline">
            {tOverdue("viewAll")}
          </Link>
        </div>
        {overdue.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">{tOverdue("empty")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {overdue.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm">
                <Link href={`/admin/contacts/${a.contactId}`} className="font-medium text-ink hover:underline">
                  {a.subject} <span className="font-normal text-ink/55">· {a.contactName}</span>
                </Link>
                <span className="text-xs font-semibold text-amber-deep">
                  {tOverdue("due", {
                    when: new Date(a.dueAt!).toLocaleString(locale === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard label={t("statAvgMessages")} value={analytics.avgMessagesPerConversation.toFixed(1)} />
        <StatCard label={t("statAvgLength")} value={t("statAvgLengthValue", { minutes: analytics.avgConversationMinutes.toFixed(1) })} />
        <StatCard
          label={t("statSatisfaction")}
          value={analytics.feedbackCount ? `${analytics.satisfactionRatePct.toFixed(0)}%` : "—"}
          hint={t("hintRated", { count: analytics.feedbackCount })}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border-2 border-ink/10 bg-canvas p-6">
          <h2 className="font-display text-lg font-bold text-ink">{t("chartByChannelTitle")}</h2>
          <div className="mt-4">
            <ChannelBreakdownChart sessionsByChannel={analytics.sessionsByChannel} />
          </div>
        </div>

        <div className="rounded-3xl border-2 border-ink/10 bg-canvas p-6">
          <h2 className="font-display text-lg font-bold text-ink">{t("chartCostTitle")}</h2>
          <p className="mt-1 text-sm text-ink/60">{t("chartCostSubtitle", { amount: analytics.monthlySpendUsd.toFixed(2) })}</p>
          <div className="mt-4">
            <CostByModelChart byModel={analytics.byModel} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border-2 border-ink/10 bg-canvas p-6">
        <h2 className="font-display text-lg font-bold text-ink">{t("topTopicsTitle")}</h2>
        <p className="mt-1 text-sm text-ink/60">{t("topTopicsSubtitle", { days })}</p>
        {analytics.topTopics.length === 0 ? (
          <p className="mt-4 text-sm text-ink/60">{t("topTopicsEmpty")}</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {analytics.topTopics.map((topic) => (
              <span key={topic.title} className="rounded-full bg-mist/60 px-3 py-1.5 text-sm font-medium text-ink">
                {topic.title} <span className="text-ink/50">· {topic.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
