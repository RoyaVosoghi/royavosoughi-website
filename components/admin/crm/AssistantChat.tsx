"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Spinner, cardClass, primaryButton, secondaryButton, textareaClass } from "./ui";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const TOOL_KEYS = ["query_leads", "query_deals", "query_activities", "crm_stats"] as const;
type ToolKey = (typeof TOOL_KEYS)[number];

/** Minimal Markdown for answers: paragraphs, "- " bullets and **bold** — enough for analytical replies, nothing executable. */
function AnswerText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (line: string, key: number) => (
    <span key={key}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
      )}
    </span>
  );
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter(Boolean);
        if (lines.length && lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={i} className="ms-5 list-disc space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""), j)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{lines.map((l, j) => [j > 0 ? <br key={`br${j}`} /> : null, inline(l, j)])}</p>;
      })}
    </div>
  );
}

export function AssistantChat() {
  const t = useTranslations("assistant");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<ToolKey | null>(null);
  const [error, setError] = useState<false | "generic" | "no_credits">(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, tool]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: Turn[] = [...turns, { role: "user", content: q }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(false);

    try {
      const response = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-20) }),
      });
      if (!response.ok || !response.body) throw new Error("bad_response");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const raw of events) {
          const event = /^event: (.+)$/m.exec(raw)?.[1];
          const data = JSON.parse(/^data: (.+)$/m.exec(raw)?.[1] ?? "{}");
          if (event === "text") {
            answer += data.text;
            setTool(null);
            setTurns([...history, { role: "assistant", content: answer }]);
          } else if (event === "tool") {
            setTool((TOOL_KEYS as readonly string[]).includes(data.name) ? (data.name as ToolKey) : null);
          } else if (event === "error") {
            throw new Error(data.error === "no_credits" ? "no_credits" : "upstream");
          }
        }
      }
      if (!answer.trim()) throw new Error("empty");
    } catch (err) {
      setError(err instanceof Error && err.message === "no_credits" ? "no_credits" : "generic");
      setTurns(history);
    } finally {
      setBusy(false);
      setTool(null);
    }
  }

  const suggestions = [t("suggestions.s1"), t("suggestions.s2"), t("suggestions.s3"), t("suggestions.s4")];

  return (
    <div className={`${cardClass} flex min-h-[60vh] flex-col`}>
      <div className="flex-1 space-y-4 overflow-y-auto">
        {turns.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border-2 border-ink/10 bg-mist/30 px-4 py-2 text-start text-sm text-ink hover:border-cobalt/40">
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {turns.map((turn, i) => (
          <div key={i} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-3xl px-5 py-3 text-sm leading-relaxed ${turn.role === "user" ? "bg-cobalt text-white" : "bg-mist/50 text-ink"}`}
              dir="auto"
            >
              {turn.role === "assistant" ? (
                turn.content ? (
                  <AnswerText text={turn.content} />
                ) : (
                  <span className="inline-flex items-center gap-2 text-ink/60">
                    <Spinner /> {tool ? t(`tools.${tool}`) : t("thinking")}
                  </span>
                )
              ) : (
                turn.content
              )}
            </div>
          </div>
        ))}
        {error ? <p className="text-sm font-medium text-amber-deep">{error === "no_credits" ? t("noCredits") : t("error")}</p> : null}
        <div ref={endRef} />
      </div>

      <form
        className="mt-4 flex items-end gap-2 border-t-2 border-ink/5 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder={t("placeholder")}
          className={`${textareaClass} flex-1 resize-none`}
          dir="auto"
        />
        <div className="flex flex-col gap-2">
          <button type="submit" disabled={busy || !input.trim()} className={primaryButton}>
            {busy ? <Spinner /> : null}
            {t("send")}
          </button>
          {turns.length ? (
            <button type="button" onClick={() => setTurns([])} disabled={busy} className={secondaryButton}>
              {t("newChat")}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
