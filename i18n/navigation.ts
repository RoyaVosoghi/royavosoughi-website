import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for next/link and the router hooks.
 * Always import Link from here — never from "next/link" — or links will
 * drop the locale prefix and bounce the user back to English.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
