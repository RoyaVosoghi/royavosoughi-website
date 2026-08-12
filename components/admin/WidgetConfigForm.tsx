"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface WidgetConfigValues {
  primaryColor: string;
  position: "bottom-end" | "bottom-start";
  welcomeMessageEn: string;
  welcomeMessageFa: string;
  allowedDomains: string[];
}

export function WidgetConfigForm({ initial }: { initial: WidgetConfigValues }) {
  const t = useTranslations("channels.widgetConfig");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [domainsText, setDomainsText] = useState(initial.allowedDomains.join("\n"));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    const allowedDomains = domainsText
      .split("\n")
      .map((d) => d.trim())
      .filter(Boolean);

    const response = await fetch("/api/admin/widget-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, allowedDomains }),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  return (
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("title")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("subtitle")}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink/70">
          {t("accentColorLabel")}
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={values.primaryColor}
              onChange={(e) => setValues({ ...values, primaryColor: e.target.value })}
              className="h-10 w-12 shrink-0 rounded-lg border-2 border-forest/15"
            />
            <input
              type="text"
              value={values.primaryColor}
              onChange={(e) => setValues({ ...values, primaryColor: e.target.value })}
              className="w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
            />
          </div>
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("positionLabel")}
          <select
            value={values.position}
            onChange={(e) => setValues({ ...values, position: e.target.value as "bottom-end" | "bottom-start" })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          >
            <option value="bottom-end">{t("positionTrailing")}</option>
            <option value="bottom-start">{t("positionLeading")}</option>
          </select>
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("welcomeEnLabel")}
          <input
            type="text"
            value={values.welcomeMessageEn}
            onChange={(e) => setValues({ ...values, welcomeMessageEn: e.target.value })}
            placeholder="Say hello, or ask a question."
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("welcomeFaLabel")}
          <input
            type="text"
            dir="rtl"
            value={values.welcomeMessageFa}
            onChange={(e) => setValues({ ...values, welcomeMessageFa: e.target.value })}
            placeholder="سلام کنید یا سوالی بپرسید."
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="sm:col-span-2 text-xs font-medium text-ink/70">
          {t("allowedDomainsLabel")}
          <textarea
            value={domainsText}
            onChange={(e) => setDomainsText(e.target.value)}
            rows={4}
            placeholder={t("allowedDomainsPlaceholder")}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 font-mono text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
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
