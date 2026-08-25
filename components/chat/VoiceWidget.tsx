"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Conversation, type Mode, type VoiceConversation } from "@elevenlabs/client";

const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "agent_8501kzxw287petfv74ank0vr0ec1";

type Phase = "idle" | "connecting" | "active" | "ending" | "error";

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

/**
 * Custom-built voice call window — replaces the pre-built <elevenlabs-convai>
 * widget entirely (see git history for that version) because its window
 * couldn't be restyled to match lib/widget/entry.ts's text-chat panel: no
 * config field produces a header bar + close button, and the call button
 * itself lives inside the same element as everything else, so there was no
 * safe way to reshape it from outside. This component owns the whole call
 * lifecycle instead, via ElevenLabs' lower-level browser SDK
 * (@elevenlabs/client), and is plain React/Tailwind — same markup shape as
 * ChatWidget.tsx's header, same colours/radii/shadow as the text-chat
 * panel's own hand-rolled CSS in lib/widget/entry.ts (kept in sync
 * manually; that file is a dependency-free vanilla-JS bundle for third-party
 * embedding and can't import from here, so there's no single source to
 * share instead).
 *
 * Positioned in the same fixed corner as the text-chat launcher, one slot
 * lower (bottom-5 vs. the chat script's data-bottom-offset="92") — the exact
 * slot the old ElevenLabs button occupied, so the two stack without
 * overlapping and nothing else needs to move.
 */
export function VoiceWidget() {
  const t = useTranslations("voice");
  const locale = useLocale() as "en" | "fa";
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<Mode>("listening");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const conversationRef = useRef<VoiceConversation | null>(null);

  // Belt-and-suspenders: end any live call if the component ever unmounts
  // (route change, etc.) so a mic never keeps streaming in the background.
  useEffect(() => {
    return () => {
      conversationRef.current?.endSession();
    };
  }, []);

  async function startCall() {
    setPhase("connecting");
    setErrorMessage(null);
    try {
      const conversation = await Conversation.startSession({
        agentId: AGENT_ID,
        textOnly: false,
        overrides: { agent: { language: locale } },
        onConnect: () => setPhase("active"),
        onDisconnect: () => {
          conversationRef.current = null;
          setPhase("idle");
        },
        onError: (message) => {
          setErrorMessage(message);
          setPhase("error");
        },
        onModeChange: ({ mode }) => setMode(mode),
      });
      conversationRef.current = conversation;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  async function endCall() {
    setPhase("ending");
    await conversationRef.current?.endSession();
    conversationRef.current = null;
    setPhase("idle");
  }

  const open = phase !== "idle";
  const statusText =
    phase === "connecting"
      ? t("connecting")
      : phase === "ending"
        ? t("ending")
        : phase === "error"
          ? t("errorBody")
          : mode === "speaking"
            ? t("speaking")
            : t("listening");

  return (
    <div
      // One higher than lib/widget/entry.ts's `.rv-root` (also
      // 2147483000): that widget's closed panel is hidden via
      // opacity/transform only (kept in the layout on purpose, for its
      // open/close animation to grow from the launcher), so its full
      // ~32rem-tall box still sits there with default pointer-events even
      // while invisible. At equal z-index the two are ordered by DOM/mount
      // order, and the chat widget mounts after this one — so its inert
      // panel silently ate clicks meant for this window's controls
      // whenever the two happened to overlap in the same corner
      // (confirmed via document.elementsFromPoint, not guessed). Strictly
      // higher z-index settles that regardless of mount order.
      className="fixed z-[2147483001] flex flex-col items-end gap-3.5"
      style={{ bottom: "20px", insetInlineEnd: "20px" }}
    >
      {open ? (
        <div
          role="dialog"
          aria-label={t("title")}
          className="flex h-[min(28rem,60vh)] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border-2 border-forest/15 bg-offwhite shadow-[0_20px_50px_rgba(2,51,22,0.25)]"
        >
          <header className="flex shrink-0 items-center justify-between bg-forest px-[18px] py-3.5">
            <p className="text-[15px] font-semibold text-offwhite">{t("title")}</p>
            <button
              type="button"
              onClick={endCall}
              disabled={phase === "ending"}
              aria-label={t("close")}
              className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-mint transition-colors hover:bg-forest-soft hover:text-offwhite disabled:opacity-50"
            >
              <CloseIcon />
            </button>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
            <div
              className={`grid h-20 w-20 place-items-center rounded-full bg-mint transition-transform duration-300 ${
                phase === "active" && mode === "speaking" ? "scale-110" : "scale-100"
              }`}
            >
              <PhoneIcon className="h-8 w-8 text-forest" />
            </div>
            <p aria-live="polite" className="text-ink/70">
              {statusText}
            </p>
            {phase === "active" ? (
              <button
                type="button"
                onClick={endCall}
                className="rounded-full bg-forest px-6 py-2.5 text-sm font-semibold text-offwhite transition-colors hover:bg-forest-soft"
              >
                {t("close")}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCall}
          aria-label={t("start")}
          className="grid h-[60px] w-[60px] place-items-center rounded-full bg-forest text-offwhite shadow-[0_8px_24px_rgba(2,51,22,0.35)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-forest-soft"
        >
          <PhoneIcon className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  );
}
