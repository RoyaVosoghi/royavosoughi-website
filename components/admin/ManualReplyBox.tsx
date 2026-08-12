"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

export function ManualReplyBox({ conversationId, paused }: { conversationId: string; paused: boolean }) {
  const router = useRouter();
  const t = useTranslations("conversations.manualReply");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) return;
    setStatus("sending");

    const response = await fetch(`/api/admin/conversations/${conversationId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }
    setContent("");
    setStatus("idle");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 rounded-2xl border-2 border-forest/10 bg-mint/20 p-4">
      {!paused ? (
        <p className="mb-2 text-xs font-medium text-saffron-deep">{t("activeWarning")}</p>
      ) : null}
      <div className="flex gap-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder={t("placeholder")}
          className="flex-1 rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending" || !content.trim()}
          className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {status === "sending" ? t("sending") : t("send")}
        </button>
      </div>
      {status === "error" ? <p className="mt-2 text-sm font-medium text-saffron-deep">{t("error")}</p> : null}
    </form>
  );
}
