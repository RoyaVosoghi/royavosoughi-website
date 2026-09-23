import Link from "next/link";

import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getConversations, type ConversationSummary } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Conversations · Admin" };

const CHANNEL_STYLES: Record<string, string> = {
  web: "bg-night text-cyan",
  widget: "bg-violet/20 text-cyan",
  telegram: "bg-soft/10 text-soft",
};

function buildColumns(
  t: Awaited<ReturnType<typeof getAdminTranslator<"conversations">>>,
): Column<ConversationSummary>[] {
  return [
    {
      header: t("list.columnChannel"),
      cell: (row) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
            CHANNEL_STYLES[row.channel] ?? "bg-soft/10 text-soft/60"
          }`}
        >
          {row.channel}
        </span>
      ),
    },
    {
      header: t("list.columnStatus"),
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-xs font-medium capitalize ${row.status === "closed" ? "text-soft/40" : "text-cyan"}`}>
            {row.status}
          </span>
          {row.botPaused ? (
            <span className="rounded-full bg-amber/20 px-2 py-0.5 text-[10px] font-semibold text-amber-soft">
              {t("list.statusPaused")}
            </span>
          ) : null}
          {row.flagged ? (
            <span className="rounded-full bg-soft/10 px-2 py-0.5 text-[10px] font-semibold text-soft">
              {t("list.statusFlagged")}
            </span>
          ) : null}
        </div>
      ),
    },
    { header: t("list.columnLeadEmail"), cell: (row) => row.leadEmail ?? "—" },
    { header: t("list.columnLocale"), cell: (row) => row.locale.toUpperCase() },
    {
      header: t("list.columnLastActive"),
      numeric: true,
      cell: (row) => new Date(row.lastActiveAt).toLocaleString(),
    },
    {
      header: "",
      cell: (row) => (
        <Link href={`/admin/conversations/${row.id}`} className="font-medium text-cyan hover:underline">
          {t("list.viewLink")}
        </Link>
      ),
    },
  ];
}

export default async function AdminConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string; q?: string }>;
}) {
  const t = await getAdminTranslator("conversations");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("list.notConfiguredTitle")} body={t("list.notConfiguredBody")} />;
  }

  const { channel, status, q } = await searchParams;
  const channelFilter = channel === "web" || channel === "telegram" || channel === "widget" ? channel : undefined;
  const statusFilter = status === "active" || status === "closed" ? status : undefined;

  const conversations = await getConversations({ channel: channelFilter, status: statusFilter, search: q });
  const columns = buildColumns(t);

  const CHANNEL_LABELS: Record<"web" | "telegram" | "widget", string> = {
    web: t("list.filterWeb"),
    telegram: t("list.filterTelegram"),
    widget: t("list.filterWidget"),
  };

  const STATUS_LABELS: Record<"active" | "closed", string> = {
    active: t("list.filterActive"),
    closed: t("list.filterClosed"),
  };

  function filterLink(next: Partial<{ channel: string; status: string; q: string }>) {
    const params = new URLSearchParams({
      ...(channelFilter ? { channel: channelFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q ? { q } : {}),
      ...next,
    });
    for (const [key, value] of Array.from(params.entries())) {
      if (!value) params.delete(key);
    }
    const qs = params.toString();
    return qs ? `/admin/conversations?${qs}` : "/admin/conversations";
  }

  return (
    <div>
      <p className="label-eyebrow text-cyan">{t("list.eyebrow")}</p>
      <h1 className="text-section mt-3 text-soft">{t("list.title")}</h1>
      <p className="mt-3 text-soft/70">{t("list.subtitle")}</p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="flex gap-1 rounded-full bg-soft/5 p-1">
          <Link
            href={filterLink({ channel: "" })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${!channelFilter ? "bg-cyan text-indigo" : "text-soft/60 hover:bg-soft/10"}`}
          >
            {t("list.filterAllChannels")}
          </Link>
          {(["web", "telegram", "widget"] as const).map((c) => (
            <Link
              key={c}
              href={filterLink({ channel: c })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${channelFilter === c ? "bg-cyan text-indigo" : "text-soft/60 hover:bg-soft/10"}`}
            >
              {CHANNEL_LABELS[c]}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-full bg-soft/5 p-1">
          <Link
            href={filterLink({ status: "" })}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${!statusFilter ? "bg-cyan text-indigo" : "text-soft/60 hover:bg-soft/10"}`}
          >
            {t("list.filterAnyStatus")}
          </Link>
          {(["active", "closed"] as const).map((s) => (
            <Link
              key={s}
              href={filterLink({ status: s })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${statusFilter === s ? "bg-cyan text-indigo" : "text-soft/60 hover:bg-soft/10"}`}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </div>
        <form action="/admin/conversations" method="get" className="flex items-center gap-2">
          {channelFilter ? <input type="hidden" name="channel" value={channelFilter} /> : null}
          {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder={t("list.searchPlaceholder")}
            className="rounded-full border-2 border-soft/15 bg-indigo px-4 py-1.5 text-sm text-soft focus:border-cyan focus:outline-none"
          />
        </form>
      </div>

      <div className="mt-8">
        {conversations.length === 0 ? (
          <EmptyState title={t("list.emptyTitle")} body={t("list.emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={conversations} />
        )}
      </div>
    </div>
  );
}
