"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { PipelineStage } from "@/lib/admin/queries";

export function PipelineStageManager({ initial }: { initial: PipelineStage[] }) {
  const router = useRouter();
  const t = useTranslations("deals.stageManager");
  const [stages, setStages] = useState(initial);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addStage() {
    const response = await fetch("/api/admin/pipeline-stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sortOrder: stages.length }),
    });
    if (!response.ok) return;
    setName("");
    router.refresh();
  }

  async function deleteStage(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    const response = await fetch(`/api/admin/pipeline-stages/${id}`, { method: "DELETE" });
    if (response.ok) {
      setStages((prev) => prev.filter((s) => s.id !== id));
      setError(null);
      return;
    }
    const body = await response.json().catch(() => ({}));
    setError(body.error === "stage_in_use" ? t("deleteInUse", { count: body.dealCount }) : t("deleteFailed"));
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const reordered = [...stages];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setStages(reordered);
    await fetch("/api/admin/pipeline-stages/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((s) => s.id) }),
    });
    router.refresh();
  }

  return (
    <div className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("title")}</h2>
      {error ? <p className="mt-2 text-sm font-medium text-saffron-deep">{error}</p> : null}
      <ul className="mt-4 flex flex-col gap-2">
        {stages.map((stage, index) => (
          <li key={stage.id} className="flex items-center justify-between gap-3 rounded-2xl border border-forest/10 bg-mint/20 px-4 py-2">
            <span className="text-sm font-medium text-ink/85">
              {stage.name}
              {stage.isWon ? <span className="ms-2 rounded-full bg-emerald/20 px-2 py-0.5 text-xs text-emerald">{t("won")}</span> : null}
              {stage.isLost ? <span className="ms-2 rounded-full bg-saffron/20 px-2 py-0.5 text-xs text-saffron-deep">{t("lost")}</span> : null}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="text-sm text-forest disabled:opacity-30" aria-label={t("moveUp")}>
                ↑
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === stages.length - 1} className="text-sm text-forest disabled:opacity-30" aria-label={t("moveDown")}>
                ↓
              </button>
              <button type="button" onClick={() => deleteStage(stage.id)} className="text-sm font-medium text-saffron-deep hover:underline">
                {t("deleteButton")}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-3">
        <input
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-2.5 text-ink focus:border-emerald focus:outline-none"
        />
        <button
          type="button"
          onClick={addStage}
          disabled={!name}
          className="rounded-full bg-emerald px-6 py-2.5 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {t("addButton")}
        </button>
      </div>
    </div>
  );
}
