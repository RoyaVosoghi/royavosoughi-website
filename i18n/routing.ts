import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fa"],
  defaultLocale: "en",
  // Always prefix, so /en and /fa are both explicit and hreflang stays honest.
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** Farsi is the only RTL locale we ship. */
export function getDirection(locale: string): "ltr" | "rtl" {
  return locale === "fa" ? "rtl" : "ltr";
}
