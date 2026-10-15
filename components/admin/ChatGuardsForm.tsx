"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ChatGuardsValues {
  injectionGuardEnabled: boolean;
  workingHours: {
    enabled: boolean;
    timezone: string;
    start: number;
    end: number;
    days: number[];
  };
}

/** Display order Monday-first; values are JS getDay() numbers (0 = Sunday). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const inputClass =
  "mt-1 w-full rounded-xl border-2 border-ink/15 bg-canvas px-3 py-2 text-sm text-ink focus:border-cobalt focus:outline-none disabled:opacity-50";

export function ChatGuardsForm({ initial }: { initial: ChatGuardsValues }) {
  const t = useTranslations("security.guards");
  const router = useRouter();
  const [guard, setGuard] = useState(initial.injectionGuardEnabled);
  const [hours, setHours] = useState(initial.workingHours);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function toggleDay(day: number) {
    setHours((h) => ({ ...h, days: h.days.includes(day) ? h.days.filter((d) => d !== day) : [...h.days, day].sort() }));
  }

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/admin/security-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ injectionGuardEnabled: guard, workingHours: hours }),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  return (
    <section className="rounded-3xl border-2 border-ink/10 bg-canvas p-6">
      <h2 className="font-display text-lg font-bold text-ink">{t("title")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("subtitle")}</p>

      <label className="mt-5 flex items-start gap-3">
        <input type="checkbox" checked={guard} onChange={(e) => setGuard(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="block text-sm font-semibold text-ink">{t("injectionLabel")}</span>
          <span className="block text-xs text-ink/60">{t("injectionHint")}</span>
        </span>
      </label>

      <div className="mt-6 border-t border-ink/10 pt-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={hours.enabled}
            onChange={(e) => setHours({ ...hours, enabled: e.target.checked })}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">{t("hoursLabel")}</span>
            <span className="block text-xs text-ink/60">{t("hoursHint")}</span>
          </span>
        </label>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-ink/70">
            {t("timezoneLabel")}
            <input
              type="text"
              dir="ltr"
              disabled={!hours.enabled}
              value={hours.timezone}
              onChange={(e) => setHours({ ...hours, timezone: e.target.value })}
              placeholder="Europe/London"
              className={inputClass}
            />
          </label>
          <label className="text-xs font-medium text-ink/70">
            {t("startLabel")}
            <input
              type="number"
              min={0}
              max={23}
              disabled={!hours.enabled}
              value={hours.start}
              onChange={(e) => setHours({ ...hours, start: Number(e.target.value) })}
              className={inputClass}
            />
          </label>
          <label className="text-xs font-medium text-ink/70">
            {t("endLabel")}
            <input
              type="number"
              min={1}
              max={24}
              disabled={!hours.enabled}
              value={hours.end}
              onChange={(e) => setHours({ ...hours, end: Number(e.target.value) })}
              className={inputClass}
            />
          </label>
        </div>

        <fieldset className="mt-4" disabled={!hours.enabled}>
          <legend className="text-xs font-medium text-ink/70">{t("daysLabel")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAY_ORDER.map((day) => {
              const active = hours.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={active}
                  className={`rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    active ? "border-cobalt bg-cobalt/10 text-cobalt" : "border-ink/15 text-ink/60 hover:border-ink/30"
                  }`}
                >
                  {t(`day.${DAY_KEYS[day]}`)}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-full bg-cobalt px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-cobalt-dark disabled:opacity-50"
        >
          {status === "saving" ? t("saving") : t("save")}
        </button>
        {status === "saved" ? <span className="text-sm font-medium text-cobalt">{t("saved")}</span> : null}
        {status === "error" ? <span className="text-sm font-medium text-amber-deep">{t("saveError")}</span> : null}
      </div>
    </section>
  );
}
