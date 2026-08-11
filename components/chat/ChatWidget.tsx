"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import type { Locale } from "@/lib/ai/types";
import { MessageBubble } from "./MessageBubble";

type Status = "idle" | "sending" | "error" | "rateLimited";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  /** Assistant messages only — lets the bubble show/submit feedback for this specific reply. */
  id?: string;
  feedback?: 1 | -1 | null;
}

const SESSION_STORAGE_KEY = "rv_chat_session_id";

function getOrCreateSessionId(): string {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, id);
  return id;
}

export function ChatWidget({ configured, locale }: { configured: boolean; locale: Locale }) {
  const t = useTranslations("chat");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  /** No database/Gemini key yet → don't show an input that silently fails. */
  if (!configured) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-forest/20 bg-mint/50 p-8 text-center">
        <p className="text-lg text-ink/80">{t("notConfigured")}</p>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !sessionId || status === "sending") return;

    const form = event.currentTarget;
    const honeypot = (form.elements.namedItem("website") as HTMLInputElement | null)?.value;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setStatus("sending");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelSessionId: sessionId,
          locale,
          message: trimmed,
          website: honeypot,
        }),
      });

      if (response.status === 429) {
        setStatus("rateLimited");
        return;
      }
      if (!response.ok) throw new Error(String(response.status));

      const data = (await response.json()) as { reply: string; messageId: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, id: data.messageId, feedback: null },
      ]);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function onRate(index: number, rating: 1 | -1) {
    const message = messages[index];
    if (!message.id || message.feedback !== null) return;

    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, feedback: rating } : m)));

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id, rating }),
      });
    } catch {
      // Best-effort — the button already reflects the visitor's choice; a
      // failed network call here isn't worth surfacing as a chat error.
    }
  }

  /** Announces status independently of the message list, which redraws wholesale on every turn. */
  const liveMessage =
    status === "sending"
      ? t("thinking")
      : status === "error"
        ? t("errorBody")
        : status === "rateLimited"
          ? t("rateLimited")
          : "";

  return (
    <div className="flex h-full flex-col bg-offwhite">
      <div aria-live="polite" role="status" className="sr-only">
        {liveMessage}
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <p className="text-ink/60">{t("emptyState")}</p>
        ) : (
          messages.map((message, index) => (
            <MessageBubble
              key={index}
              role={message.role}
              content={message.content}
              feedback={message.feedback}
              onRate={message.role === "assistant" ? (rating) => onRate(index, rating) : undefined}
            />
          ))
        )}
        {status === "sending" ? (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-2xl bg-mint px-4 py-3 text-ink/60">
              {t("thinking")}
            </div>
          </div>
        ) : null}
      </div>

      {status === "error" || status === "rateLimited" ? (
        <p
          role="alert"
          className="border-t border-forest/10 px-5 py-3 text-sm font-medium text-saffron-deep"
        >
          {status === "rateLimited" ? t("rateLimited") : t("errorBody")}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="flex items-center gap-3 border-t border-forest/10 p-4">
        {/* Honeypot — hidden from people, tempting to bots. Never remove. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="chat-website">Website</label>
          <input id="chat-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("inputPlaceholder")}
          disabled={status === "sending"}
          className="w-full rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-3 text-ink transition-colors placeholder:text-ink/35 focus:border-emerald focus:outline-none"
        />
        <Button type="submit" disabled={status === "sending" || !input.trim()}>
          {status === "sending" ? t("sending") : t("send")}
        </Button>
      </form>
    </div>
  );
}
