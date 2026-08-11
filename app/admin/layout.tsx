import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";

import "../globals.css";

/**
 * /admin sits outside app/[locale]/ on purpose — it's Roya's own internal
 * tool, not a bilingual visitor-facing page, so it gets its own <html>/<body>
 * (the real root layout at app/layout.tsx deliberately has none — see the
 * comment there) with English-only fonts, no next-intl, no Header/Footer.
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

export const metadata: Metadata = {
  title: "Admin · Roya Vosoughi",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="locale-en min-h-dvh bg-offwhite">{children}</body>
    </html>
  );
}
