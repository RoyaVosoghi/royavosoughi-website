import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on everything except API routes, the internal admin panel (its own
  // English-only tree outside [locale] — see app/admin/layout.tsx), the
  // client-facing proposal/contract pages (their language comes from the
  // document itself, not the URL — see app/(documents)/layout.tsx), Next
  // internals, and files with an extension (images, svg, robots.txt, …).
  matcher: ["/((?!api|admin|proposal/|contract/|_next|_vercel|.*\..*).*)"],
};
