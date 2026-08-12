"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { groupedModelCatalog } from "@/lib/ai/model-catalog";
import type { WeekdaySchedule } from "@/lib/ai/model-config";

export interface ModelConfigRow {
  channel: "web" | "telegram" | "widget";
  provider: string;
  activeModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  fallbackModel: string | null;
  schedule: WeekdaySchedule | null;
}

function ModelSelect({
  value,
  onChange,
  allowNone,
  noOverrideLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
  noOverrideLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
    >
      {allowNone ? <option value="">{noOverrideLabel}</option> : null}
      {groupedModelCatalog().map((group) => (
        <optgroup key={group.group} label={group.label}>
          {group.models.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function ChannelCard({
  initial,
  channelLabel,
}: {
  initial: ModelConfigRow;
  channelLabel: string;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [row, setRow] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [scheduleOpen, setScheduleOpen] = useState(Boolean(initial.schedule && Object.keys(initial.schedule).length));

  const WEEKDAYS: Array<{ key: keyof WeekdaySchedule; label: string }> = [
    { key: "0", label: t("models.weekdaySunday") },
    { key: "1", label: t("models.weekdayMonday") },
    { key: "2", label: t("models.weekdayTuesday") },
    { key: "3", label: t("models.weekdayWednesday") },
    { key: "4", label: t("models.weekdayThursday") },
    { key: "5", label: t("models.weekdayFriday") },
    { key: "6", label: t("models.weekdaySaturday") },
  ];

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/admin/model-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  function setScheduleDay(day: keyof WeekdaySchedule, model: string) {
    const next = { ...(row.schedule ?? {}) };
    if (model) next[day] = model;
    else delete next[day];
    setRow({ ...row, schedule: Object.keys(next).length ? next : null });
  }

  return (
    <div className="rounded-2xl border-2 border-forest/10 bg-mint/20 p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-bold text-forest">{channelLabel}</p>
        <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-medium text-ink/60">
          {row.provider}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="col-span-2 text-xs font-medium text-ink/70">
          {t("models.modelLabel")}
          <ModelSelect
            value={row.activeModel}
            onChange={(v) => setRow({ ...row, activeModel: v })}
            noOverrideLabel={t("models.noOverride")}
          />
        </label>
        <label className="col-span-2 text-xs font-medium text-ink/70">
          {t("models.fallbackLabel")}
          <ModelSelect
            value={row.fallbackModel ?? ""}
            onChange={(v) => setRow({ ...row, fallbackModel: v || null })}
            allowNone
            noOverrideLabel={t("models.noOverride")}
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("models.temperatureLabel")}
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={row.temperature}
            onChange={(e) => setRow({ ...row, temperature: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("models.topPLabel")}
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={row.topP}
            onChange={(e) => setRow({ ...row, topP: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="col-span-2 text-xs font-medium text-ink/70">
          {t("models.maxTokensLabel")}
          <input
            type="number"
            min={64}
            max={8192}
            value={row.maxTokens}
            onChange={(e) => setRow({ ...row, maxTokens: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => setScheduleOpen((v) => !v)}
        className="mt-4 text-xs font-medium text-emerald hover:underline"
      >
        {scheduleOpen ? t("models.scheduleHide") : t("models.scheduleShow")}
      </button>

      {scheduleOpen ? (
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-offwhite p-3 sm:grid-cols-2">
          {WEEKDAYS.map((day) => (
            <label key={day.key} className="text-xs font-medium text-ink/70">
              {day.label}
              <ModelSelect
                value={row.schedule?.[day.key] ?? ""}
                onChange={(v) => setScheduleDay(day.key, v)}
                allowNone
                noOverrideLabel={t("models.noOverride")}
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {status === "saving" ? t("models.saving") : t("models.save")}
        </button>
        {status === "saved" ? <span className="text-sm font-medium text-emerald">{t("models.saved")}</span> : null}
        {status === "error" ? <span className="text-sm font-medium text-saffron-deep">{t("models.error")}</span> : null}
      </div>
    </div>
  );
}

export function ModelConfigForm({ initial }: { initial: ModelConfigRow[] }) {
  const t = useTranslations("settings");

  const CHANNEL_LABELS: Record<ModelConfigRow["channel"], string> = {
    web: t("models.channelWeb"),
    telegram: t("models.channelTelegram"),
    widget: t("models.channelWidget"),
  };

  return (
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("models.heading")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("models.description")}</p>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {initial.map((row) => (
          <ChannelCard key={row.channel} initial={row} channelLabel={CHANNEL_LABELS[row.channel]} />
        ))}
      </div>
    </section>
  );
}
