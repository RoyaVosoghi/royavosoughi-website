import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminLocale, getAdminTranslator } from "@/lib/admin/i18n/server";
import { getServiceRequests, type ServiceRequest } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";
import en from "@/messages/en.json";
import fa from "@/messages/fa.json";

export const metadata = { title: "Service requests · Admin" };

// Always read fresh — a request sent a minute ago should be visible on reload.
export const dynamic = "force-dynamic";

function buildColumns(
  t: Awaited<ReturnType<typeof getAdminTranslator<"serviceRequests">>>,
  serviceNames: Record<string, { name: string }>,
): Column<ServiceRequest>[] {
  return [
    {
      header: t("columnReceived"),
      numeric: true,
      cell: (row) => <span className="whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</span>,
    },
    {
      header: t("columnService"),
      cell: (row) => (
        <span className="whitespace-nowrap rounded-full bg-mist px-3 py-1 text-xs font-semibold text-cobalt">
          {serviceNames[row.service]?.name ?? row.service}
        </span>
      ),
    },
    { header: t("columnName"), cell: (row) => row.name },
    { header: t("columnBusiness"), cell: (row) => row.business },
    { header: t("columnContact"), cell: (row) => <span dir="ltr">{row.contact}</span> },
    {
      header: t("columnEmail"),
      cell: (row) => (
        <a className="text-cobalt hover:underline" href={`mailto:${row.email}`} dir="ltr">
          {row.email}
        </a>
      ),
    },
    {
      header: t("columnMessage"),
      cell: (row) => <p className="min-w-[16rem] max-w-md whitespace-pre-wrap">{row.message}</p>,
    },
  ];
}

export default async function AdminServiceRequestsPage() {
  const t = await getAdminTranslator("serviceRequests");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const locale = await getAdminLocale();
  const requests = await getServiceRequests();
  const columns = buildColumns(t, (locale === "fa" ? fa : en).services.items);

  return (
    <div>
      <p className="label-eyebrow text-cobalt">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-ink">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8">
        {requests.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <DataTable columns={columns} rows={requests} />
        )}
      </div>
    </div>
  );
}
