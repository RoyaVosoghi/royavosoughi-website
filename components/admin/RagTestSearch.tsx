"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

interface SearchResult {
  id: string;
  content: string;
  documentTitle: string;
  similarity: number;
}

export function RagTestSearch() {
  const t = useTranslations("knowledge");
  const [query, setQuery] = useState("");
  const [locale, setLocale] = useState<"en" | "fa">("en");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [status, setStatus] = useState<"idle" | "searching" | "error">("idle");

  async function search() {
    if (!query.trim()) return;
    setStatus("searching");
    const response = await fetch("/api/admin/rag-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, locale, k: 8 }),
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
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("testSearch.heading")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("testSearch.subtitle")}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder={t("testSearch.placeholder")}
          className="min-w-[240px] flex-1 rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
        />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as "en" | "fa")}
          className="rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
        >
          <option value="en">{t("localeEnglish")}</option>
          <option value="fa">{t("localeFa")}</option>
        </select>
        <button
          type="button"
          onClick={search}
          disabled={status === "searching" || !query.trim()}
          className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {status === "searching" ? t("testSearch.searching") : t("testSearch.search")}
        </button>
      </div>

      {status === "error" ? <p className="mt-3 text-sm font-medium text-saffron-deep">{t("testSearch.error")}</p> : null}

      {results ? (
        <div className="mt-5 flex flex-col gap-2">
          {results.length === 0 ? (
            <p className="text-sm text-ink/60">{t("testSearch.empty")}</p>
          ) : (
            results.map((r) => (
              <div key={r.id} className="rounded-xl border border-forest/10 bg-mint/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-forest">{r.documentTitle}</span>
                  <span className="tabular-nums text-xs text-ink/60">{(r.similarity * 100).toFixed(1)}%</span>
                </div>
                <p className="mt-1 text-sm text-ink/80">{r.content}</p>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
