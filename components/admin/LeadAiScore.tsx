"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

function scoreColor(score: number): string {
  if (score >= 70) return "bg-emerald/20 text-emerald";
  if (score >= 40) return "bg-spring/20 text-emerald";
  return "bg-forest/10 text-ink/60";
}

export function LeadAiScore({ id, score, reason }: { id: string; score: number | null; reason: string | null }) {
  const router = useRouter();
  const t = useTranslations("leads.aiScore");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function runScore() {
    setPending(true);
    setError(false);
    const response = await fetch(`/api/admin/leads/${id}/score`, { method: "POST" });
    setPending(false);
    if (!response.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  if (score !== null) {
    return (
      <span
        title={reason ?? undefined}
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${scoreColor(score)}`}
      >
        {score}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={runScore}
        disabled={pending}
        className="rounded-full border-2 border-forest/15 px-2.5 py-1 text-xs font-medium text-forest transition-colors hover:bg-mint/40 disabled:opacity-50"
      >
        {pending ? t("scoring") : t("scoreButton")}
      </button>
      {error ? <span className="text-xs text-saffron-deep">{t("scoreFailed")}</span> : null}
    </div>
  );
}
