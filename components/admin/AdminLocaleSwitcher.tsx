"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { ADMIN_LOCALE_COOKIE, type AdminLocale } from "@/lib/admin/i18n/shared";

/** Toggles the admin-only locale cookie and refreshes — admin URLs stay the same in either language, unlike app/[locale]'s /en vs /fa routing. */
export function AdminLocaleSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const locale = useLocale() as AdminLocale;
  const t = useTranslations("nav");
  const next: AdminLocale = locale === "fa" ? "en" : "fa";

  function switchLocale() {
    document.cookie = `${ADMIN_LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <button type="button" onClick={switchLocale} className={className}>
      {next === "fa" ? t("switchToFa") : t("switchToEn")}
    </button>
  );
}
