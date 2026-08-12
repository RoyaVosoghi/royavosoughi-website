import "server-only";

import { cookies } from "next/headers";
import { createTranslator } from "use-intl/core";

import en, { type AdminMessages } from "./en";
import fa from "./fa";
import { ADMIN_LOCALE_COOKIE, isAdminLocale, type AdminLocale } from "./shared";

const MESSAGES: Record<AdminLocale, AdminMessages> = { en, fa };

export async function getAdminLocale(): Promise<AdminLocale> {
  const store = await cookies();
  const value = store.get(ADMIN_LOCALE_COOKIE)?.value;
  return isAdminLocale(value) ? value : "en";
}

export async function getAdminMessages(): Promise<AdminMessages> {
  return MESSAGES[await getAdminLocale()];
}

/**
 * Server Components' equivalent of the useTranslations() hook — admin has
 * its own cookie-based locale rather than app/[locale]'s routing, so this
 * calls use-intl's createTranslator directly instead of next-intl/server's
 * getTranslations (which resolves locale through the public site's request
 * config and would always answer "en" here). Mirrors getTranslations' own
 * <NestedKey = never> + explicit-type-argument pattern rather than an
 * `| undefined` generic — passing namespace through a cast breaks
 * createTranslator's key-type inference.
 */
export async function getAdminTranslator<NS extends keyof AdminMessages = never>(namespace?: NS) {
  const locale = await getAdminLocale();
  return createTranslator<AdminMessages, NS>({ locale, messages: MESSAGES[locale], namespace: namespace as NS });
}
