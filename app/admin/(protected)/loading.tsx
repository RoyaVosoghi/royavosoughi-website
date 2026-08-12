import { getAdminTranslator } from "@/lib/admin/i18n/server";

/**
 * Shared Suspense fallback for every route under app/admin/(protected)/ —
 * Next.js wraps a segment's page (and any nested segment without its own
 * loading.tsx) in this automatically, so one file here covers all 14 admin
 * pages instead of duplicating a skeleton per page.
 */
export default async function AdminLoading() {
  const t = await getAdminTranslator("loading");

  return (
    <div aria-live="polite" aria-busy="true" className="animate-pulse">
      <span className="sr-only">{t("srLabel")}</span>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="h-3 w-20 rounded-full bg-forest/10" />
          <div className="mt-3 h-7 w-40 rounded-full bg-forest/10" />
        </div>
        <div className="h-8 w-28 rounded-full bg-forest/10" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-3xl border-2 border-forest/10 bg-forest/5" />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-3xl border-2 border-forest/10 bg-forest/5" />
        <div className="h-64 rounded-3xl border-2 border-forest/10 bg-forest/5" />
      </div>
    </div>
  );
}
