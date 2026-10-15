import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk, Vazirmatn } from "next/font/google";

import "../globals.css";

/**
 * Client-facing document pages (/proposal/<token>, /contract/<token>). Like
 * /admin they sit outside app/[locale] — the language comes from the
 * document, not the URL — so they own their <html>/<body>. The page itself
 * sets dir/lang on its wrapper once it knows the document's locale.
 * Never indexed: these URLs are private links.
 */

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const vazirmatn = Vazirmatn({ subsets: ["arabic", "latin"], variable: "--font-vazirmatn", display: "swap" });

export const metadata: Metadata = {
  title: "Roya Vosoughi",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${vazirmatn.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-mist/50" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
