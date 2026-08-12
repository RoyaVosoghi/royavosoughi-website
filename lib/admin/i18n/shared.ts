/** No "server-only" here — imported by client components (the locale switcher) as well as server code. */
export type AdminLocale = "en" | "fa";

export const ADMIN_LOCALE_COOKIE = "rv_admin_locale";

export function isAdminLocale(value: string | undefined): value is AdminLocale {
  return value === "en" || value === "fa";
}

/** Persian is the only RTL locale the admin panel ships — mirrors i18n/routing.ts's getDirection for the public site. */
export function getAdminDirection(locale: AdminLocale): "ltr" | "rtl" {
  return locale === "fa" ? "rtl" : "ltr";
}
