import type { ReactNode } from "react";

/**
 * Next requires a root layout, but <html> lives in app/[locale]/layout.tsx —
 * that is the only place where the locale (and therefore lang/dir) is known.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
