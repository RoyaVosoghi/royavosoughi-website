"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Round light/dark switch for the header. Both icons are always rendered and
 * the `dark:` variant picks one, so the server HTML is correct for either
 * theme and nothing shifts on hydration.
 */
export function ThemeToggle() {
  const t = useTranslations("nav");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private mode / blocked storage — the switch still works for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={t("theme")}
      title={t("theme")}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-ink/20 text-ink transition-colors hover:border-ink/40 hover:text-cobalt"
    >
      {/* Moon in light — offers dark */}
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 dark:hidden"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
      {/* Sun in dark — offers light */}
      <svg
        viewBox="0 0 24 24"
        className="hidden h-5 w-5 dark:block"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
