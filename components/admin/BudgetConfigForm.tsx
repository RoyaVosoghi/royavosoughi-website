"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function BudgetConfigForm({
  monthlyCapUsd,
  alertThresholdPct,
  spentUsd,
  crmAiUsd,
}: {
  monthlyCapUsd: number | null;
  alertThresholdPct: number;
  spentUsd: number;
  crmAiUsd: number;
}) {
  const t = useTranslations("security.budget");
  const router = useRouter();
  const [cap, setCap] = useState(monthlyCapUsd ?? 0);
  const [capEnabled, setCapEnabled] = useState(monthlyCapUsd !== null);
  const [threshold, setThreshold] = useState(alertThresholdPct);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const pctUsed = monthlyCapUsd ? Math.min(100, (spentUsd / monthlyCapUsd) * 100) : null;
  const overThreshold = pctUsed !== null && pctUsed >= alertThresholdPct;

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/admin/budget-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyCapUsd: capEnabled ? cap : null, alertThresholdPct: threshold }),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  return (
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("title")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("subtitle")}</p>

      <p className="mt-3 font-display text-2xl font-bold text-forest">
        ${spentUsd.toFixed(2)}
        <span className="text-sm font-normal text-ink/50">
          {" "}
          {t("spentThisMonth")}
          {monthlyCapUsd ? ` ${t("spentOfCap", { cap: monthlyCapUsd.toFixed(2) })}` : ""}
        </span>
      </p>
      {overThreshold ? (
        <p className="mt-1 text-sm font-semibold text-saffron-deep">{t("overThreshold", { threshold: alertThresholdPct })}</p>
      ) : null}
      {crmAiUsd > 0 ? <p className="mt-1 text-xs text-ink/50">{t("crmAiUsdNote", { amount: crmAiUsd.toFixed(2) })}</p> : null}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink/70">
          <span className="flex items-center gap-2">
            <input type="checkbox" checked={capEnabled} onChange={(e) => setCapEnabled(e.target.checked)} className="h-4 w-4" />
            {t("capLabel")}
          </span>
          <input
            type="number"
            min={0}
            step={1}
            disabled={!capEnabled}
            value={cap}
            onChange={(e) => setCap(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none disabled:opacity-50"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("thresholdLabel")}
          <input
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {status === "saving" ? t("saving") : t("save")}
        </button>
        {status === "saved" ? <span className="text-sm font-medium text-emerald">{t("saved")}</span> : null}
        {status === "error" ? <span className="text-sm font-medium text-saffron-deep">{t("saveError")}</span> : null}
      </div>
    </section>
  );
}
