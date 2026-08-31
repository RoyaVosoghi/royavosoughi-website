"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { Deal, PipelineStage } from "@/lib/admin/queries";

export function DealEditForm({ deal, stages }: { deal: Deal; stages: PipelineStage[] }) {
  const router = useRouter();
  const t = useTranslations("deals.detail");
  const [title, setTitle] = useState(deal.title);
  const [amount, setAmount] = useState(String(deal.amountCents / 100));
  const [currency, setCurrency] = useState(deal.currency);
  const [pipelineStageId, setPipelineStageId] = useState(deal.pipelineStageId);
  const [expectedCloseDate, setExpectedCloseDate] = useState(deal.expectedCloseDate ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    const response = await fetch(`/api/admin/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        amountCents: Math.round(Number(amount) * 100),
        currency,
        pipelineStageId,
        expectedCloseDate: expectedCloseDate || null,
      }),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  return (
    <div className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink/70">
          {t("fieldTitle")}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("fieldStage")}
          <select
            value={pipelineStageId}
            onChange={(e) => setPipelineStageId(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("fieldAmount")}
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("fieldCurrency")}
          <input
            type="text"
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70 sm:col-span-2">
          {t("fieldExpectedClose")}
          <input
            type="date"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
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
    </div>
  );
}
