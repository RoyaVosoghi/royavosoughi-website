import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Run on everything except API routes, the internal admin panel (its own
  // English-only tree outside [locale] — see app/admin/layout.tsx), Next
  // internals, and files with an extension (images, svg, robots.txt, …).
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
