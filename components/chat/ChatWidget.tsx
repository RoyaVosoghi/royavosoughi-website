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
  /** Only set on a freshly-received reply, not on restored history — grounding sources aren't stored for old messages. */
  sources?: string[];
}

const SESSION_STORAGE_KEY = "rv_chat_session_id";

function getOrCreateSessionId(): string {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, id);
  return id;
}

export function ChatWidget({
  configured,
  locale,
  showStarters = false,
  showConsultationButton = false,
}: {
  configured: boolean;
  locale: Locale;
  /** Full-page-only extras — kept off the homepage bubble so it stays minimal. */
  showStarters?: boolean;
  showConsultationButton?: boolean;
}) {
  const t = useTranslations("chat");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const listRef = useRef<HTMLDivElement>(null);
  const starters = t.raw("starters") as string[];

  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);

    fetch(`/api/chat/history?channelSessionId=${id}`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data: { messages: Array<{ id: string; role: "user" | "assistant"; content: string }> }) => {
        if (data.messages.length === 0) return;
        setMessages(
          data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            id: m.role === "assistant" ? m.id : undefined,
            feedback: m.role === "assistant" ? null : undefined,
          })),
        );
      })
      .catch(() => {
        // No history is a normal, silent outcome — never block the widget on this.
      });
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

  async function sendMessage(text: string, honeypot?: string) {
    if (!text || !sessionId || status === "sending") return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStatus("sending");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelSessionId: sessionId,
          locale,
          message: text,
          website: honeypot,
        }),
      });

      if (response.status === 429) {
        setStatus("rateLimited");
        return;
      }
      if (!response.ok) throw new Error(String(response.status));

      const data = (await response.json()) as { reply: string; messageId: string; sources: string[] };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, id: data.messageId, feedback: null, sources: data.sources },
      ]);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const form = event.currentTarget;
    const honeypot = (form.elements.namedItem("website") as HTMLInputElement | null)?.value;
    setInput("");
    await sendMessage(trimmed, honeypot);
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
          <div className="flex flex-col gap-4">
            <p className="text-ink/60">{t("emptyState")}</p>
            {showStarters ? (
              <div className="flex flex-wrap gap-2">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => sendMessage(starter)}
                    className="rounded-full border-2 border-forest/15 bg-offwhite px-4 py-2 text-sm text-ink/80 transition-colors hover:border-emerald hover:text-emerald"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className="flex flex-col gap-1">
              <MessageBubble
                role={message.role}
                content={message.content}
                feedback={message.feedback}
                onRate={message.role === "assistant" ? (rating) => onRate(index, rating) : undefined}
              />
              {message.sources && message.sources.length > 0 ? (
                <p className={`px-1 text-xs text-ink/40 ${message.role === "user" ? "text-end" : "text-start"}`}>
                  {t("sourcesLabel")}: {message.sources.join(", ")}
                </p>
              ) : null}
            </div>
          ))
        )}
        {status === "sending" ? (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-2xl bg-mint px-4 py-3 text-ink/60">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40" />
              </span>
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

      {showConsultationButton ? (
        <div className="border-t border-forest/10 px-5 pt-3">
          <button
            type="button"
            onClick={() => sendMessage(t("consultationMessage"))}
            disabled={status === "sending"}
            className="w-full rounded-full border-2 border-emerald px-5 py-2.5 text-sm font-semibold text-emerald transition-colors hover:bg-emerald hover:text-offwhite disabled:opacity-50"
          >
            {t("requestConsultation")}
          </button>
        </div>
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
