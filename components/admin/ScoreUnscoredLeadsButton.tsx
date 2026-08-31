"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function ScoreUnscoredLeadsButton() {
  const router = useRouter();
  const t = useTranslations("leads.aiScore");
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    await fetch("/api/admin/leads/score-unscored", { method: "POST" });
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="rounded-full border-2 border-forest/20 px-5 py-2 text-sm font-semibold text-forest transition-colors hover:bg-mint/40 disabled:opacity-50"
    >
      {pending ? t("scoringBatch") : t("scoreUnscoredButton")}
    </button>
  );
}
