"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type Status = "idle" | "previewing" | "previewed" | "sending" | "sent" | "error";

export function BroadcastForm() {
  const t = useTranslations("broadcast.form");
  const [message, setMessage] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  async function preview() {
    setStatus("previewing");
    const response = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    const data = (await response.json()) as { recipientCount: number };
    setRecipientCount(data.recipientCount);
    setStatus("previewed");
  }

  async function send() {
    if (!window.confirm(t("confirmSend", { count: recipientCount ?? 0 }))) {
      return;
    }
    setStatus("sending");
    const response = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, confirm: true }),
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    const data = (await response.json()) as { sent: number; failed: number };
    setResult(data);
    setStatus("sent");
  }

  return (
    <div className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <label className="mb-2 block text-sm font-medium text-ink/80">{t("messageLabel")}</label>
      <textarea
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setStatus("idle");
          setRecipientCount(null);
        }}
        rows={6}
        placeholder={t("messagePlaceholder")}
        className="w-full rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-3 text-ink transition-colors focus:border-emerald focus:outline-none"
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {recipientCount === null ? (
          <button
            type="button"
            onClick={preview}
            disabled={!message.trim() || status === "previewing"}
            className="rounded-full border-2 border-forest text-forest px-6 py-3 text-sm font-semibold transition-colors hover:bg-forest hover:text-offwhite disabled:opacity-50"
          >
            {status === "previewing" ? t("previewing") : t("previewButton")}
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={status === "sending" || status === "sent"}
            className="rounded-full bg-emerald px-6 py-3 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
          >
            {status === "sending" ? t("sending") : t("sendButton", { count: recipientCount })}
          </button>
        )}
        {status === "error" ? <span className="text-sm font-medium text-saffron-deep">{t("errorGeneric")}</span> : null}
        {status === "sent" && result ? (
          <span className="text-sm font-medium text-emerald">
            {result.failed > 0 ? t("sentResultWithFailed", { sent: result.sent, failed: result.failed }) : t("sentResult", { sent: result.sent })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
