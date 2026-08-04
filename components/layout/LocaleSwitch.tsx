"use client";

import { useParams } from "next/navigation";
import { useTransition } from "react";
import { useLocale } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const labels: Record<string, string> = {
  en: "EN",
  fa: "فارسی",
};

/**
 * Switches locale while staying on the SAME page.
 * usePathname() from i18n/navigation returns the path without the locale
 * prefix, so /fa/about → /en/about rather than dumping the user on the home page.
 */
export function LocaleSwitch({ onDark = false }: { onDark?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(
        // @ts-expect-error — pathnames are not statically typed in this setup
        { pathname, params },
        { locale: next },
      );
    });
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border p-0.5 ${
        onDark ? "border-mint-deep/40" : "border-forest/20"
      } ${isPending ? "opacity-60" : ""}`}
      role="group"
      aria-label="Language"
    >
      {routing.locales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => switchTo(code)}
            aria-current={active ? "true" : undefined}
            lang={code}
            className={`min-h-11 min-w-11 rounded-full px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-emerald text-offwhite"
                : onDark
                  ? "text-mint hover:text-offwhite"
                  : "text-ink/70 hover:text-forest"
            }`}
          >
            {labels[code] ?? code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
