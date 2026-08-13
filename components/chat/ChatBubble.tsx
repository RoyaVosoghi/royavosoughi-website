"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { Locale } from "@/lib/ai/types";
import { ChatWidget } from "./ChatWidget";

/**
 * Homepage-only floating launcher. Fixed to the LEADING corner via logical
 * start-6/bottom-6 — the mirror image of the original design (which used
 * end-6). The ElevenLabs voice widget (see ElevenLabsVoiceWidget.tsx,
 * rendered site-wide) inherits page direction too and always claims the
 * logical *trailing* corner (bottom-right in English, bottom-left in
 * Farsi), so putting this one on the opposite logical corner keeps them
 * apart in both languages without any locale branching. The panel stays
 * mounted at all times — only its visibility/scale is toggled — so the
 * conversation (held inside ChatWidget's state) survives closing and
 * reopening the bubble.
 */
export function ChatBubble({
  configured,
  locale,
  welcomeOverride,
  startersOverride,
}: {
  configured: boolean;
  locale: Locale;
  welcomeOverride?: string | null;
  startersOverride?: string[];
}) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 start-6 z-50 flex flex-col items-start gap-4">
      <div
        className={`h-[32rem] max-h-[70vh] w-[calc(100vw-3rem)] max-w-sm origin-bottom-start overflow-hidden rounded-3xl border-2 border-forest/15 bg-offwhite shadow-2xl transition-all duration-200 ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between bg-forest px-5 py-4">
            <p className="font-semibold text-offwhite">{t("bubbleTitle")}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("closeChat")}
              className="grid h-8 w-8 place-items-center rounded-full text-mint transition-colors hover:bg-forest-soft hover:text-offwhite"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <ChatWidget
              configured={configured}
              locale={locale}
              welcomeOverride={welcomeOverride}
              startersOverride={startersOverride}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t("closeChat") : t("openChat")}
        className="grid h-16 w-16 place-items-center rounded-full bg-emerald text-offwhite shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          )}
        </svg>
      </button>
    </div>
  );
}
