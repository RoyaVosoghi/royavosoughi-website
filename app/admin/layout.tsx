import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { Inter, Space_Grotesk, Vazirmatn } from "next/font/google";

import { getAdminLocale, getAdminMessages } from "@/lib/admin/i18n/server";
import { getAdminDirection } from "@/lib/admin/i18n/shared";

import "../globals.css";

/**
 * /admin sits outside app/[locale]/ on purpose — it's Roya's own internal
 * tool, not a bilingual visitor-facing page, so it gets its own <html>/<body>
 * (the real root layout at app/layout.tsx deliberately has none — see the
 * comment there). It's bilingual (EN/FA) like the public site, but through
 * its own cookie-based locale (lib/admin/i18n) rather than app/[locale]'s
 * URL routing — admin URLs stay stable regardless of language.
 */

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Admin · Roya Vosoughi",
  robots: { index: false, follow: false },
};

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const locale = await getAdminLocale();
  const messages = await getAdminMessages();
  const dir = getAdminDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${spaceGrotesk.variable} ${inter.variable} ${vazirmatn.variable}`}
      suppressHydrationWarning
    >
      <body className={`locale-${locale} min-h-dvh bg-offwhite`} suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
