"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { Wordmark } from "@/components/ui/Logo";
import { LocaleSwitch } from "./LocaleSwitch";

const navItems = [
  { key: "services", href: "/#services" },
  { key: "projects", href: "/#projects" },
  { key: "about", href: "/about" },
  { key: "chat", href: "/chat" },
  { key: "contact", href: "/#contact" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close the mobile menu on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:rounded-full focus:bg-forest focus:px-5 focus:py-3 focus:text-offwhite"
      >
        {t("skipToContent")}
      </a>

      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-offwhite/85 backdrop-blur-md shadow-[0_1px_0_0_rgba(2,51,22,0.1)]"
            : "bg-transparent"
        }`}
      >
        <div className="container-page flex h-20 items-center justify-between gap-4">
          <Link
            href="/"
            className="text-[#2B3A55] hover:text-emerald transition-colors"
            aria-label={t("home")}
          >
            <Wordmark />
          </Link>

          <nav
            className="hidden items-center gap-8 md:flex"
            aria-label={t("primary")}
          >
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="text-[0.9375rem] font-medium text-ink/75 transition-colors hover:text-emerald"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <LocaleSwitch />
            </div>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-forest/20 text-forest md:hidden"
            >
              <span className="sr-only">{open ? t("close") : t("menu")}</span>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {open ? (
                  <path d="M5 5l14 14M19 5L5 19" />
                ) : (
                  <path d="M3 7h18M3 12h18M3 17h18" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div
          id="mobile-menu"
          className="fixed inset-0 top-20 z-30 bg-offwhite md:hidden"
        >
          <nav
            className="container-page flex flex-col gap-1 py-8"
            aria-label={t("primary")}
          >
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="border-b border-forest/10 py-5 text-2xl font-semibold text-forest"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="pt-8">
              <LocaleSwitch />
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
