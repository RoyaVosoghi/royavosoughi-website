"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface SecurityConfigValues {
  rateLimitWindowMinutes: number;
  rateLimitMaxMessages: number;
  retentionDays: number | null;
}

export function SecurityConfigForm({ initial }: { initial: SecurityConfigValues }) {
  const t = useTranslations("security.rateLimit");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [retentionEnabled, setRetentionEnabled] = useState(initial.retentionDays !== null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [cleanupStatus, setCleanupStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/admin/security-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, retentionDays: retentionEnabled ? values.retentionDays : null }),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  async function runCleanup() {
    if (!confirm(t("confirmCleanup"))) return;
    setCleanupStatus("running");
    const response = await fetch("/api/admin/security/cleanup", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setCleanupStatus("done");
      setCleanupMessage(t("cleanupResult", { conversations: body.conversationsDeleted, rateLimitHits: body.rateLimitHitsDeleted }));
    } else {
      setCleanupStatus("error");
      setCleanupMessage(t("cleanupError"));
    }
  }

  return (
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("title")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("subtitle")}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-ink/70">
          {t("windowLabel")}
          <input
            type="number"
            min={1}
            max={1440}
            value={values.rateLimitWindowMinutes}
            onChange={(e) => setValues({ ...values, rateLimitWindowMinutes: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("maxMessagesLabel")}
          <input
            type="number"
            min={1}
            max={1000}
            value={values.rateLimitMaxMessages}
            onChange={(e) => setValues({ ...values, rateLimitMaxMessages: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          <span className="flex items-center gap-2">
            <input type="checkbox" checked={retentionEnabled} onChange={(e) => setRetentionEnabled(e.target.checked)} className="h-4 w-4" />
            {t("retentionLabel")}
          </span>
          <input
            type="number"
            min={1}
            max={3650}
            disabled={!retentionEnabled}
            value={values.retentionDays ?? 90}
            onChange={(e) => setValues({ ...values, retentionDays: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none disabled:opacity-50"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
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

        <button
          type="button"
          onClick={runCleanup}
          disabled={cleanupStatus === "running" || !retentionEnabled}
          className="rounded-full border-2 border-saffron-deep/40 px-5 py-2 text-sm font-semibold text-saffron-deep transition-colors hover:bg-saffron/10 disabled:opacity-50"
        >
          {cleanupStatus === "running" ? t("runningCleanup") : t("runCleanup")}
        </button>
      </div>
      {cleanupMessage ? <p className="mt-2 text-sm text-ink/60">{cleanupMessage}</p> : null}
    </section>
  );
}
