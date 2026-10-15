"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Field, Notice, Spinner, cardClass, inputClass, primaryButton, textareaClass } from "./ui";

const SEGMENTS = ["stale_leads", "lost_leads", "lost_deals", "won_customers"] as const;

export function CampaignCreateForm() {
  const router = useRouter();
  const t = useTranslations("campaigns");
  const tc = useTranslations("crmDocs");
  const [name, setName] = useState("");
  const [segmentKey, setSegmentKey] = useState<(typeof SEGMENTS)[number]>("stale_leads");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, segmentKey, goal }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error === "empty_segment" ? t("emptySegment") : tc("errors.generic"));
      return;
    }
    router.push(`/admin/campaigns/${data.id}`);
  }

  return (
    <section className={cardClass}>
      <h2 className="font-display text-lg font-bold text-ink">{t("createTitle")}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label={t("name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} className={inputClass} dir="auto" />
        </Field>
        <Field label={t("segment")} hint={t("maxNote")}>
          <select value={segmentKey} onChange={(e) => setSegmentKey(e.target.value as (typeof SEGMENTS)[number])} className={inputClass}>
            {SEGMENTS.map((key) => (
              <option key={key} value={key}>
                {t(`segments.${key}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("goal")} className="md:col-span-2">
          <textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t("goalPlaceholder")} className={textareaClass} dir="auto" />
        </Field>
      </div>
      {error ? (
        <div className="mt-4">
          <Notice tone="warn">{error}</Notice>
        </div>
      ) : null}
      <button type="button" onClick={submit} disabled={busy || !name.trim() || goal.trim().length < 5} className={`${primaryButton} mt-4`}>
        {busy ? <Spinner /> : null}
        {busy ? t("creating") : t("create")}
      </button>
    </section>
  );
}
