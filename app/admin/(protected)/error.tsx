"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * Shared error boundary for every route under app/admin/(protected)/ — same
 * "one file covers all pages" reasoning as loading.tsx. Catches render/data
 * errors from a page's server component (e.g. a Supabase query throwing)
 * that would otherwise fall through to Next's unstyled default error page.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <div role="alert" className="rounded-3xl border-2 border-dashed border-saffron-deep/30 bg-saffron-deep/5 p-10 text-center">
      <p className="font-display text-lg font-bold text-forest">{t("title")}</p>
      <p className="mt-2 text-ink/70">{t("body")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-offwhite transition-colors hover:bg-forest"
        >
          {t("retry")}
        </button>
        <a
          href="/admin"
          className="rounded-full border-2 border-forest/15 px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:border-emerald hover:text-emerald"
        >
          {t("backToDashboard")}
        </a>
      </div>
    </div>
  );
}
