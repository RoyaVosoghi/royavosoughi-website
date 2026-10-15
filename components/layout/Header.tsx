"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { Wordmark } from "@/components/ui/Logo";
import { buttonStyles } from "@/components/ui/Button";
import { LocaleSwitch } from "./LocaleSwitch";

const navItems = [
  { key: "homeNav", href: "/" },
  { key: "services", href: "/#services" },
  { key: "projects", href: "/#projects" },
  { key: "blog", href: "/blog" },
  { key: "about", href: "/about" },
  { key: "chat", href: "/chat" },
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
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-canvas"
      >
        {t("skipToContent")}
      </a>

      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-canvas/85 backdrop-blur-md shadow-[0_1px_0_0_rgba(30,30,30,0.1)]"
            : "bg-transparent"
        }`}
      >
        {/* Three zones: logo | nav pill | CTA + language. The grid's 1fr side
            columns keep the pill centred whatever the side widths, and the
            whole row mirrors in RTL. Slightly wider than container-page so
            the pill has room to breathe at xl. */}
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-4 px-gutter xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-8">
          <Link
            href="/"
            className="justify-self-start text-ink transition-opacity hover:opacity-80"
            aria-label={t("home")}
          >
            <Wordmark />
          </Link>

          <nav
            className="hidden items-center gap-1 rounded-full border border-ink/15 bg-canvas/60 p-1.5 xl:flex"
            aria-label={t("primary")}
          >
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="rounded-full px-4 py-2 text-[0.9375rem] font-medium whitespace-nowrap text-ink/75 transition-colors hover:bg-ink/5 hover:text-cobalt"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-3">
            <div className="hidden md:block">
              <Link href="/contact" className={`${buttonStyles("primary")} whitespace-nowrap`}>
                {t("cta")}
              </Link>
            </div>

            <div className="hidden sm:block">
              <LocaleSwitch />
            </div>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink/20 text-ink xl:hidden"
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
          className="fixed inset-0 top-20 z-30 bg-canvas xl:hidden"
        >
          <nav
            className="container-page flex flex-col gap-1 py-8"
            aria-label={t("primary")}
          >
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="border-b border-ink/10 py-5 text-2xl font-semibold text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t(item.key)}
              </Link>
            ))}
            <Link
              href="/contact"
              className={`mt-6 justify-center ${buttonStyles("primary")}`}
            >
              {t("cta")}
            </Link>
            <div className="pt-8">
              <LocaleSwitch />
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
