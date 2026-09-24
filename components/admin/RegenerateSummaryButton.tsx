"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function RegenerateSummaryButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const t = useTranslations("contacts.detail");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function run() {
    setPending(true);
    setError(false);
    const response = await fetch(`/api/admin/contacts/${contactId}/summary`, { method: "POST" });
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
        className="rounded-full border-2 border-navy/20 px-4 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-mist/40 disabled:opacity-50"
      >
        {pending ? t("regenerating") : t("regenerateButton")}
      </button>
      {error ? <span className="text-xs text-amber-deep">{t("regenerateFailed")}</span> : null}
    </div>
  );
}
