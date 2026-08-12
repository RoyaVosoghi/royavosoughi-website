"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getEmbeddingCatalogEntry, groupedEmbeddingCatalog } from "@/lib/ai/embedding-catalog";

export interface EmbeddingConfigValues {
  provider: string;
  model: string;
  dimensions: number;
  inputType: string | null;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  rerankerEnabled: boolean;
  rerankerModel: string | null;
}

export function EmbeddingConfigForm({ initial }: { initial: EmbeddingConfigValues }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [rebuildStatus, setRebuildStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [rebuildResult, setRebuildResult] = useState<string | null>(null);
  const [pendingModelChange, setPendingModelChange] = useState<{ provider: string; model: string } | null>(null);

  const PROVIDER_LABELS: Record<string, string> = {
    cohere: t("embedding.providerCohere"),
    openai: t("embedding.providerOpenai"),
    google: t("embedding.providerGoogle"),
    voyage: t("embedding.providerVoyage"),
  };

  function applyModelChange(provider: string, model: string) {
    const entry = getEmbeddingCatalogEntry(provider, model);
    setValues({
      ...values,
      provider,
      model,
      dimensions: entry?.dimensions ?? values.dimensions,
      inputType: entry?.supportsInputType ? "search_document" : null,
    });
    setPendingModelChange(null);
  }

  function requestModelChange(provider: string, model: string) {
    if (provider === values.provider && model === values.model) return;
    setPendingModelChange({ provider, model });
  }

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/admin/embedding-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  async function rebuildIndex() {
    setRebuildStatus("running");
    setRebuildResult(null);
    const response = await fetch("/api/admin/embedding-config/rebuild", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setRebuildStatus("done");
      const failedSuffix = body.failed ? t("embedding.rebuildFailedSuffix", { failed: body.failed }) : "";
      setRebuildResult(t("embedding.rebuildResult", { updated: body.updated, total: body.total, failedSuffix }));
      router.refresh();
    } else {
      setRebuildStatus("error");
      setRebuildResult(
        body.error === "provider_not_configured"
          ? t("embedding.rebuildErrorProviderNotConfigured")
          : t("embedding.rebuildErrorGeneric"),
      );
    }
  }

  return (
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("embedding.heading")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("embedding.description")}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-ink/70">
          {t("embedding.modelLabel")}
          <select
            value={`${values.provider}::${values.model}`}
            onChange={(e) => {
              const [provider, model] = e.target.value.split("::");
              requestModelChange(provider, model);
            }}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          >
            {groupedEmbeddingCatalog().map((group) => (
              <optgroup key={group.provider} label={PROVIDER_LABELS[group.provider]}>
                {group.models.map((m) => (
                  <option key={m.model} value={`${m.provider}::${m.model}`}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("embedding.dimensionsLabel")}
          <input
            type="number"
            min={64}
            max={3072}
            value={values.dimensions}
            disabled={!getEmbeddingCatalogEntry(values.provider, values.model)?.customDimensions}
            onChange={(e) => setValues({ ...values, dimensions: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none disabled:opacity-50"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("embedding.chunkSizeLabel")}
          <input
            type="number"
            min={100}
            max={6000}
            value={values.chunkSize}
            onChange={(e) => setValues({ ...values, chunkSize: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("embedding.chunkOverlapLabel")}
          <input
            type="number"
            min={0}
            max={1000}
            value={values.chunkOverlap}
            onChange={(e) => setValues({ ...values, chunkOverlap: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("embedding.topKLabel")}
          <input
            type="number"
            min={1}
            max={20}
            value={values.topK}
            onChange={(e) => setValues({ ...values, topK: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("embedding.similarityThresholdLabel")}
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={values.similarityThreshold}
            onChange={(e) => setValues({ ...values, similarityThreshold: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-ink/70">
          <input
            type="checkbox"
            checked={values.rerankerEnabled}
            onChange={(e) => setValues({ ...values, rerankerEnabled: e.target.checked })}
            className="h-4 w-4"
          />
          {t("embedding.rerankerLabel")}
        </label>
      </div>

      {pendingModelChange ? (
        <div className="mt-4 rounded-xl border-2 border-saffron-deep/40 bg-saffron/10 p-4">
          <p className="text-sm font-semibold text-saffron-deep">{t("embedding.pendingTitle")}</p>
          <p className="mt-1 text-sm text-ink/70">
            {t("embedding.pendingBody", {
              provider: PROVIDER_LABELS[pendingModelChange.provider],
              model: pendingModelChange.model,
            })}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => applyModelChange(pendingModelChange.provider, pendingModelChange.model)}
              className="rounded-full bg-saffron-deep px-4 py-1.5 text-xs font-semibold text-offwhite"
            >
              {t("embedding.switchAnyway")}
            </button>
            <button
              type="button"
              onClick={() => setPendingModelChange(null)}
              className="rounded-full border-2 border-forest/20 px-4 py-1.5 text-xs font-semibold text-ink/70"
            >
              {t("embedding.cancel")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving" || Boolean(pendingModelChange)}
          className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {status === "saving" ? t("embedding.saving") : t("embedding.save")}
        </button>
        {status === "saved" ? <span className="text-sm font-medium text-emerald">{t("embedding.saved")}</span> : null}
        {status === "error" ? <span className="text-sm font-medium text-saffron-deep">{t("embedding.error")}</span> : null}

        <button
          type="button"
          onClick={rebuildIndex}
          disabled={rebuildStatus === "running"}
          className="rounded-full border-2 border-forest/20 px-5 py-2 text-sm font-semibold text-forest transition-colors hover:bg-mint/40 disabled:opacity-50"
        >
          {rebuildStatus === "running" ? t("embedding.rebuilding") : t("embedding.rebuild")}
        </button>
        {rebuildResult ? (
          <span className={`text-sm font-medium ${rebuildStatus === "error" ? "text-saffron-deep" : "text-emerald"}`}>
            {rebuildResult}
          </span>
        ) : null}
      </div>
    </section>
  );
}
