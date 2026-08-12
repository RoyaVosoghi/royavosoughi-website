"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AllChannelGreetingsRow } from "@/lib/ai/channel-greetings";

function Row({ row }: { row: AllChannelGreetingsRow }) {
  const t = useTranslations("channels.greetings");
  const router = useRouter();
  const [welcome, setWelcome] = useState(row.welcomeMessage ?? "");
  const [replies, setReplies] = useState(row.quickReplies.join(", "));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/admin/channel-greetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: row.channel,
        locale: row.locale,
        welcomeMessage: welcome.trim() || null,
        quickReplies: replies
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean),
      }),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  const channelLabel =
    row.channel === "web" ? t("channelWeb") : row.channel === "telegram" ? t("channelTelegram") : t("channelWidget");
  const localeLabel = row.locale === "en" ? t("localeEn") : t("localeFa");

  return (
    <div className="rounded-2xl border-2 border-forest/10 bg-mint/20 p-4">
      <p className="font-display text-sm font-bold text-forest">
        {channelLabel} · {localeLabel}
      </p>
      {row.channel === "widget" ? <p className="mt-1 text-xs text-ink/50">{t("widgetNote")}</p> : null}
      <div className="mt-3 flex flex-col gap-2">
        {row.channel !== "widget" ? (
          <input
            type="text"
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            placeholder={t("welcomePlaceholder")}
            className="w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        ) : null}
        <input
          type="text"
          value={replies}
          onChange={(e) => setReplies(e.target.value)}
          placeholder={t("quickRepliesPlaceholder")}
          className="w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-full bg-emerald px-4 py-1.5 text-xs font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {status === "saving" ? t("saving") : t("save")}
        </button>
        {status === "saved" ? <span className="text-xs font-medium text-emerald">{t("saved")}</span> : null}
        {status === "error" ? <span className="text-xs font-medium text-saffron-deep">{t("saveError")}</span> : null}
      </div>
    </div>
  );
}

export function ChannelGreetingsForm({ initial }: { initial: AllChannelGreetingsRow[] }) {
  const t = useTranslations("channels.greetings");
  return (
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("title")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("subtitle")}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initial.map((row) => (
          <Row key={`${row.channel}:${row.locale}`} row={row} />
        ))}
      </div>
    </section>
  );
}
