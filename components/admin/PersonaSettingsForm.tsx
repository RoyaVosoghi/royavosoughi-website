"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface LocaleState {
  content: string;
  status: "idle" | "saving" | "saved" | "error";
}

export function PersonaSettingsForm({
  initialEn,
  initialFa,
  historyCountEn,
  historyCountFa,
}: {
  initialEn: string;
  initialFa: string;
  historyCountEn: number;
  historyCountFa: number;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [en, setEn] = useState<LocaleState>({ content: initialEn, status: "idle" });
  const [fa, setFa] = useState<LocaleState>({ content: initialFa, status: "idle" });

  async function save(locale: "en" | "fa") {
    const [state, setState] = locale === "en" ? [en, setEn] : [fa, setFa];
    setState((s) => ({ ...s, status: "saving" }));

    const response = await fetch("/api/admin/prompt-versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, content: state.content }),
    });

    setState((s) => ({ ...s, status: response.ok ? "saved" : "error" }));
    if (response.ok) router.refresh();
  }

  async function reset(locale: "en" | "fa") {
    const setState = locale === "en" ? setEn : setFa;
    setState((s) => ({ ...s, status: "saving" }));

    const response = await fetch("/api/admin/prompt-versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, content: "", reset: true }),
    });

    setState((s) => ({ ...s, status: response.ok ? "saved" : "error" }));
    if (response.ok) router.refresh();
  }

  return (
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("persona.heading")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("persona.description")}</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(
          [
            { key: "en" as const, label: t("persona.localeEnglish"), state: en, setState: setEn, historyCount: historyCountEn },
            { key: "fa" as const, label: t("persona.localeFa"), state: fa, setState: setFa, historyCount: historyCountFa },
          ]
        ).map(({ key, label, state, setState, historyCount }) => (
          <div key={key}>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-ink/80">{t("persona.systemPromptLabel", { locale: label })}</label>
              <span className="text-xs text-ink/40">{t("persona.historyCount", { count: historyCount })}</span>
            </div>
            <textarea
              dir={key === "fa" ? "rtl" : "ltr"}
              value={state.content}
              onChange={(e) => setState({ ...state, content: e.target.value })}
              rows={16}
              className="w-full rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-2.5 font-mono text-xs leading-relaxed text-ink transition-colors focus:border-emerald focus:outline-none"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => save(key)}
                disabled={state.status === "saving"}
                className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
              >
                {state.status === "saving" ? t("persona.saving") : t("persona.save")}
              </button>
              <button
                type="button"
                onClick={() => reset(key)}
                disabled={state.status === "saving"}
                className="rounded-full border-2 border-forest/15 px-5 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-forest/5 disabled:opacity-50"
              >
                {t("persona.reset")}
              </button>
              {state.status === "saved" ? <span className="text-sm font-medium text-emerald">{t("persona.saved")}</span> : null}
              {state.status === "error" ? (
                <span className="text-sm font-medium text-saffron-deep">{t("persona.error")}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
