"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { groupedModelCatalog } from "@/lib/ai/model-catalog";

interface PlaygroundResult {
  reply: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  retrievedChunks: Array<{ id: string; content: string; documentTitle: string; similarity: number }>;
  toolCalls: string[];
}

export function PlaygroundConsole({ defaultModel }: { defaultModel: string }) {
  const t = useTranslations("playground");
  const [message, setMessage] = useState("");
  const [locale, setLocale] = useState<"en" | "fa">("en");
  const [modelA, setModelA] = useState(defaultModel);
  const [compare, setCompare] = useState(false);
  const [modelB, setModelB] = useState(defaultModel);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [topP, setTopP] = useState(0.95);
  const [promptOverride, setPromptOverride] = useState("");
  const [results, setResults] = useState<PlaygroundResult[] | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");

  async function run() {
    if (!message.trim()) return;
    setStatus("running");
    setResults(null);

    const response = await fetch("/api/admin/playground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        locale,
        models: compare ? [modelA, modelB] : [modelA],
        temperature,
        maxTokens,
        topP,
        promptOverride: promptOverride.trim() || undefined,
      }),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }
    const body = await response.json();
    setResults(body.results);
    setStatus("idle");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink/70 sm:col-span-2">
            {t("messageLabel")}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder={t("messagePlaceholder")}
              className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-ink/70">
            {t("localeLabel")}
            <select value={locale} onChange={(e) => setLocale(e.target.value as "en" | "fa")} className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none">
              <option value="en">{t("localeEnglish")}</option>
              <option value="fa">{t("localeFa")}</option>
            </select>
          </label>
          <label className="flex items-end gap-2 text-xs font-medium text-ink/70">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-4 w-4" />
            {t("compareLabel")}
          </label>
          <label className="text-xs font-medium text-ink/70">
            {compare ? t("modelALabel") : t("modelLabel")}
            <select value={modelA} onChange={(e) => setModelA(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none">
              {groupedModelCatalog().map((g) => (
                <optgroup key={g.group} label={g.label}>
                  {g.models.map((m) => (
                    <option key={m.slug} value={m.slug}>{m.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {compare ? (
            <label className="text-xs font-medium text-ink/70">
              {t("modelBLabel")}
              <select value={modelB} onChange={(e) => setModelB(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none">
                {groupedModelCatalog().map((g) => (
                  <optgroup key={g.group} label={g.label}>
                    {g.models.map((m) => (
                      <option key={m.slug} value={m.slug}>{m.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          ) : null}
          <label className="text-xs font-medium text-ink/70">
            {t("temperatureLabel")}
            <input type="number" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none" />
          </label>
          <label className="text-xs font-medium text-ink/70">
            {t("topPLabel")}
            <input type="number" min={0} max={1} step={0.05} value={topP} onChange={(e) => setTopP(Number(e.target.value))} className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none" />
          </label>
          <label className="text-xs font-medium text-ink/70">
            {t("maxTokensLabel")}
            <input type="number" min={64} max={8192} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none" />
          </label>
          <label className="text-xs font-medium text-ink/70 sm:col-span-2">
            {t("personaOverrideLabel")}
            <textarea
              value={promptOverride}
              onChange={(e) => setPromptOverride(e.target.value)}
              rows={3}
              placeholder={t("personaOverridePlaceholder")}
              className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={status === "running" || !message.trim()}
          className="mt-4 rounded-full bg-emerald px-6 py-2.5 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {status === "running" ? t("running") : t("run")}
        </button>
        {status === "error" ? <p className="mt-2 text-sm font-medium text-saffron-deep">{t("runError")}</p> : null}
      </div>

      {results ? (
        <div className={`grid grid-cols-1 gap-6 ${results.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {results.map((r, i) => (
            <div key={i} className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
              <p className="font-display text-sm font-bold text-forest">{r.model}</p>
              <p className="mt-1 text-xs text-ink/50">
                {t("tokensLine", { tokensIn: r.tokensIn ?? "?", tokensOut: r.tokensOut ?? "?" })}
                {r.toolCalls.length ? t("toolCallsSuffix", { calls: r.toolCalls.join(", ") }) : ""}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-ink/85">{r.reply || t("emptyReply")}</p>

              {r.retrievedChunks.length > 0 ? (
                <details className="mt-4 text-xs text-ink/60">
                  <summary className="cursor-pointer font-semibold">{t("chunksRetrieved", { count: r.retrievedChunks.length })}</summary>
                  <ul className="mt-2 flex flex-col gap-2">
                    {r.retrievedChunks.map((c) => (
                      <li key={c.id} className="rounded-lg bg-mint/30 p-2">
                        <span className="font-semibold">{c.documentTitle}</span> · {(c.similarity * 100).toFixed(1)}%
                        <p className="mt-1">{c.content.slice(0, 160)}{c.content.length > 160 ? "…" : ""}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="mt-4 text-xs text-ink/40">{t("noChunksRetrieved")}</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
