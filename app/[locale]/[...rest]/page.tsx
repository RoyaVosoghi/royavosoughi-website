import { notFound } from "next/navigation";

/**
 * Catch-all inside the locale segment.
 *
 * Without this, an unmatched path like /fa/typo never matches a route under
 * [locale], so Next falls back to the ROOT app/not-found.tsx — an unstyled
 * English page with no header, footer or translation. Matching here means the
 * request enters the locale layout first, so app/[locale]/not-found.tsx renders
 * in the visitor's own language.
 */
export default function CatchAllNotFound() {
  notFound();
}
