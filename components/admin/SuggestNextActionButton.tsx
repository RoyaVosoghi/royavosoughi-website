"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function SuggestNextActionButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const t = useTranslations("deals.detail");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function run() {
    setPending(true);
    setError(false);
    const response = await fetch(`/api/admin/deals/${dealId}/next-action`, { method: "POST" });
    setPending(false);
    if (!response.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-full border-2 border-forest/20 px-4 py-1.5 text-xs font-semibold text-forest transition-colors hover:bg-mint/40 disabled:opacity-50"
      >
        {pending ? t("suggesting") : t("suggestButton")}
      </button>
      {error ? <span className="text-xs text-saffron-deep">{t("suggestFailed")}</span> : null}
    </div>
  );
}
