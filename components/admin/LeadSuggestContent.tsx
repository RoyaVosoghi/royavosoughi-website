"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Suggestion {
  post: { title: string; url: string };
  message: string;
  logged: boolean;
}

export function LeadSuggestContent({ id }: { id: string }) {
  const t = useTranslations("leadContent");
  const tc = useTranslations("crmDocs");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Suggestion | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/admin/leads/${id}/suggest-content`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(
        data.error === "no_posts"
          ? t("noPosts")
          : data.error === "ai_no_credits"
            ? tc("errors.ai_no_credits")
            : data.error === "ai_not_configured"
              ? tc("errors.ai_not_configured")
              : tc("errors.ai_failed"),
      );
      return;
    }
    setResult(data);
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard?.writeText(`${result.message}\n\n${result.post.url}`).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="self-start whitespace-nowrap rounded-full border-2 border-ink/15 px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-mist/40 disabled:opacity-50"
      >
        {pending ? t("working") : t("button")}
      </button>
      {error ? <span className="max-w-56 text-xs text-amber-deep">{error}</span> : null}
      {result ? (
        <div className="w-72 rounded-2xl border-2 border-cobalt/20 bg-cobalt/5 p-3 text-xs">
          <p className="font-semibold text-ink/60">{t("title")}</p>
          <a href={result.post.url} target="_blank" rel="noreferrer" className="mt-1 block font-semibold text-cobalt hover:underline" dir="auto">
            {result.post.title}
          </a>
          <p className="mt-2 whitespace-pre-wrap text-ink/85" dir="auto">
            {result.message}
          </p>
          {result.logged ? <p className="mt-2 text-ink/50">{t("logged")}</p> : null}
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={copy} className="font-semibold text-cobalt hover:underline">
              {copied ? t("copied") : t("copy")}
            </button>
            <button type="button" onClick={() => setResult(null)} className="text-ink/50 hover:text-ink">
              {t("close")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
