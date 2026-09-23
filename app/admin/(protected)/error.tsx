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
    <div role="alert" className="rounded-3xl border-2 border-dashed border-amber/30 bg-amber/5 p-10 text-center">
      <p className="font-display text-lg font-bold text-soft">{t("title")}</p>
      <p className="mt-2 text-soft/70">{t("body")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-cyan px-5 py-2.5 text-sm font-semibold text-indigo transition-colors hover:bg-soft"
        >
          {t("retry")}
        </button>
        <a
          href="/admin"
          className="rounded-full border-2 border-soft/15 px-5 py-2.5 text-sm font-semibold text-soft transition-colors hover:border-cyan hover:text-cyan"
        >
          {t("backToDashboard")}
        </a>
      </div>
    </div>
  );
}
