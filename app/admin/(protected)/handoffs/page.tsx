import Link from "next/link";

import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { ResolveHandoffButton } from "@/components/admin/ResolveHandoffButton";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getHandoffRequests, type HandoffRequest } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Handoffs · Admin" };

function buildColumns(
  t: Awaited<ReturnType<typeof getAdminTranslator<"handoffs">>>,
): Column<HandoffRequest>[] {
  const REASON_LABELS: Record<string, string> = {
    out_of_scope: t("reasonOutOfScope"),
    user_requested: t("reasonUserRequested"),
    other: t("reasonOther"),
  };

  return [
    { header: t("columnReason"), cell: (row) => REASON_LABELS[row.reason] ?? row.reason },
    { header: t("columnNote"), cell: (row) => row.note ?? "—" },
    { header: t("columnLocale"), cell: (row) => row.locale.toUpperCase() },
    {
      header: t("columnConversation"),
      cell: (row) =>
        row.sessionId ? (
          <Link href={`/admin/conversations/${row.sessionId}`} className="text-emerald hover:underline">
            {t("viewLink")}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      header: t("columnFlagged"),
      numeric: true,
      cell: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      header: "",
      cell: (row) => <ResolveHandoffButton id={row.id} resolved={row.resolved} />,
    },
  ];
}

export default async function AdminHandoffsPage() {
  const t = await getAdminTranslator("handoffs");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const handoffs = await getHandoffRequests();
  const columns = buildColumns(t);

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8">
        {handoffs.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={handoffs} />
        )}
      </div>
    </div>
  );
}
