"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

function scoreColor(score: number): string {
  if (score >= 70) return "bg-cyan/20 text-cyan";
  if (score >= 40) return "bg-violet/20 text-cyan";
  return "bg-soft/10 text-soft/60";
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
        className="rounded-full border-2 border-soft/15 px-2.5 py-1 text-xs font-medium text-soft transition-colors hover:bg-violet/10 disabled:opacity-50"
      >
        {pending ? t("scoring") : t("scoreButton")}
      </button>
      {error ? <span className="text-xs text-amber-soft">{t("scoreFailed")}</span> : null}
    </div>
  );
}
