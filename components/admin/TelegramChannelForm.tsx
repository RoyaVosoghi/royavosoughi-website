"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TelegramChannelForm({
  maskedBotToken,
  maskedWebhookSecret,
  siteUrl,
}: {
  maskedBotToken: string | null;
  maskedWebhookSecret: string | null;
  siteUrl: string;
}) {
  const t = useTranslations("channels.telegram");
  const router = useRouter();
  const [botToken, setBotToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [registerStatus, setRegisterStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);

  async function save() {
    setSaveStatus("saving");
    const response = await fetch("/api/admin/channels/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botToken: botToken.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      }),
    });
    setSaveStatus(response.ok ? "saved" : "error");
    if (response.ok) {
      setBotToken("");
      setWebhookSecret("");
      router.refresh();
    }
  }

  async function registerWebhook() {
    setRegisterStatus("running");
    setRegisterMessage(null);
    const response = await fetch("/api/admin/channels/telegram/register-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl: siteUrl }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.ok) {
      setRegisterStatus("done");
      setRegisterMessage(t("registerSuccess", { url: `${siteUrl}/api/telegram/webhook` }));
    } else {
      setRegisterStatus("error");
      setRegisterMessage(body.description || t("registerErrorFallback"));
    }
  }

  return (
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("title")}</h2>
      <p className="mt-1 text-sm text-ink/60">{t("subtitle")}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink/70">
          {t("botTokenLabel")} {maskedBotToken ? <span className="text-ink/40">{t("currentValue", { value: maskedBotToken })}</span> : null}
          <input
            type="text"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={maskedBotToken ? t("placeholderKeepCurrent") : t("botTokenPlaceholder")}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 font-mono text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          {t("webhookSecretLabel")}{" "}
          {maskedWebhookSecret ? <span className="text-ink/40">{t("currentValue", { value: maskedWebhookSecret })}</span> : null}
          <input
            type="text"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={maskedWebhookSecret ? t("placeholderKeepCurrent") : t("webhookSecretPlaceholder")}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 font-mono text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saveStatus === "saving" || (!botToken.trim() && !webhookSecret.trim())}
          className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {saveStatus === "saving" ? t("saving") : t("save")}
        </button>
        {saveStatus === "saved" ? <span className="text-sm font-medium text-emerald">{t("saved")}</span> : null}
        {saveStatus === "error" ? <span className="text-sm font-medium text-saffron-deep">{t("saveError")}</span> : null}

        <button
          type="button"
          onClick={registerWebhook}
          disabled={registerStatus === "running" || (!maskedBotToken && !botToken.trim())}
          className="rounded-full border-2 border-forest/20 px-5 py-2 text-sm font-semibold text-forest transition-colors hover:bg-mint/40 disabled:opacity-50"
        >
          {registerStatus === "running" ? t("registering") : t("registerWebhook")}
        </button>
      </div>
      {registerMessage ? (
        <p className={`mt-2 text-sm font-medium ${registerStatus === "error" ? "text-saffron-deep" : "text-emerald"}`}>{registerMessage}</p>
      ) : null}
    </section>
  );
}
