import Link from "next/link";

import { ActivityCompleteButton } from "@/components/admin/ActivityCompleteButton";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getActivitiesWithContact, type ActivityType, type ActivityWithContact } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Activities · Admin" };

const TYPES: ActivityType[] = ["call", "meeting", "note", "task"];

function buildColumns(t: Awaited<ReturnType<typeof getAdminTranslator<"activities">>>): Column<ActivityWithContact>[] {
  return [
    { header: t("columnType"), cell: (row) => <span className="capitalize">{row.type}</span> },
    { header: t("columnSubject"), cell: (row) => row.subject },
    { header: t("columnContact"), cell: (row) => row.contactName },
    {
      header: t("columnDue"),
      cell: (row) => {
        if (!row.dueAt) return "—";
        const overdue = !row.completedAt && new Date(row.dueAt) < new Date();
        return (
          <span className={overdue ? "font-semibold text-saffron-deep" : ""}>
            {new Date(row.dueAt).toLocaleString()}
            {overdue ? <span className="ms-2 rounded-full bg-saffron/20 px-2 py-0.5 text-[10px] font-semibold">{t("overdueBadge")}</span> : null}
          </span>
        );
      },
    },
    { header: t("columnStatus"), cell: (row) => <ActivityCompleteButton id={row.id} completed={Boolean(row.completedAt)} /> },
  ];
}

export default async function AdminActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; overdue?: string }>;
}) {
  const t = await getAdminTranslator("activities");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const { type, overdue } = await searchParams;
  const typeFilter = TYPES.includes(type as ActivityType) ? (type as ActivityType) : undefined;
  const overdueOnly = overdue === "1";

  const activities = await getActivitiesWithContact({ type: typeFilter, overdueOnly });
  const columns = buildColumns(t);

  function filterLink(next: Partial<{ type: string; overdue: string }>) {
    const params = new URLSearchParams({
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(overdueOnly ? { overdue: "1" } : {}),
      ...next,
    });
    for (const [key, value] of Array.from(params.entries())) {
      if (!value) params.delete(key);
    }
    const qs = params.toString();
    return qs ? `/admin/activities?${qs}` : "/admin/activities";
  }

  const TYPE_LABELS: Record<ActivityType, string> = {
    call: t("typeCall"),
    meeting: t("typeMeeting"),
    note: t("typeNote"),
    task: t("typeTask"),
  };

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="flex gap-1 rounded-full bg-forest/5 p-1">
          <Link
            href={filterLink({ type: "" })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${!typeFilter ? "bg-emerald text-offwhite" : "text-ink/60 hover:bg-forest/10"}`}
          >
            {t("filterAllTypes")}
          </Link>
          {TYPES.map((ty) => (
            <Link
              key={ty}
              href={filterLink({ type: ty })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${typeFilter === ty ? "bg-emerald text-offwhite" : "text-ink/60 hover:bg-forest/10"}`}
            >
              {TYPE_LABELS[ty]}
            </Link>
          ))}
        </div>
        <Link
          href={filterLink({ overdue: overdueOnly ? "" : "1" })}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${overdueOnly ? "bg-saffron text-offwhite" : "bg-forest/5 text-ink/60 hover:bg-forest/10"}`}
        >
          {t("filterOverdueOnly")}
        </Link>
      </div>

      <div className="mt-8">
        {activities.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={activities} />
        )}
      </div>
    </div>
  );
}
