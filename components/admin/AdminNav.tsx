"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { AdminLocaleSwitcher } from "./AdminLocaleSwitcher";

interface NavLink {
  href: string;
  labelKey:
    | "linkDashboard"
    | "linkKnowledgeBase"
    | "linkPersonaModels"
    | "linkPlayground"
    | "linkInbox"
    | "linkHandoffs"
    | "linkLeads"
    | "linkRegistrations"
    | "linkFeedback"
    | "linkContacts"
    | "linkChannels"
    | "linkBroadcast"
    | "linkTeam"
    | "linkAuditLog"
    | "linkSecurity";
}

interface NavGroup {
  labelKey: "groupOverview" | "groupKnowledgeAi" | "groupInboxPeople" | "groupChannels" | "groupSystem";
  links: NavLink[];
}

const GROUPS: NavGroup[] = [
  {
    labelKey: "groupOverview",
    links: [{ href: "/admin", labelKey: "linkDashboard" }],
  },
  {
    labelKey: "groupKnowledgeAi",
    links: [
      { href: "/admin/knowledge", labelKey: "linkKnowledgeBase" },
      { href: "/admin/settings", labelKey: "linkPersonaModels" },
      { href: "/admin/playground", labelKey: "linkPlayground" },
    ],
  },
  {
    labelKey: "groupInboxPeople",
    links: [
      { href: "/admin/conversations", labelKey: "linkInbox" },
      { href: "/admin/handoffs", labelKey: "linkHandoffs" },
      { href: "/admin/leads", labelKey: "linkLeads" },
      { href: "/admin/registrations", labelKey: "linkRegistrations" },
      { href: "/admin/feedback", labelKey: "linkFeedback" },
      { href: "/admin/contacts", labelKey: "linkContacts" },
    ],
  },
  {
    labelKey: "groupChannels",
    links: [
      { href: "/admin/channels", labelKey: "linkChannels" },
      { href: "/admin/broadcast", labelKey: "linkBroadcast" },
    ],
  },
  {
    labelKey: "groupSystem",
    links: [
      { href: "/admin/team", labelKey: "linkTeam" },
      { href: "/admin/audit-log", labelKey: "linkAuditLog" },
      { href: "/admin/security", labelKey: "linkSecurity" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const t = useTranslations("nav");

  return (
    <nav className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <div key={group.labelKey}>
          <p className="label-eyebrow px-3 text-mint-deep/70">{t(group.labelKey)}</p>
          <div className="mt-2 flex flex-col gap-1">
            {group.links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNavigate}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-spring text-forest"
                      : "text-mint-deep hover:bg-forest-soft hover:text-offwhite"
                  }`}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between gap-4 bg-forest px-5 py-4 lg:hidden">
        <p className="font-display text-lg font-bold text-offwhite">
          {t("brand")}
          <span className="text-spring">.</span>
          {t("brandSuffix")}
        </p>
        <div className="flex items-center gap-2">
          <AdminLocaleSwitcher className="rounded-full border-2 border-mint-deep px-3 py-1.5 text-sm font-medium text-offwhite" />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="admin-mobile-nav"
            className="rounded-full border-2 border-mint-deep px-3 py-1.5 text-sm font-medium text-offwhite"
          >
            {mobileOpen ? t("close") : t("menu")}
          </button>
        </div>
      </header>
      {mobileOpen ? (
        <div id="admin-mobile-nav" className="border-b-2 border-forest-soft bg-forest px-4 py-4 lg:hidden">
          <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-6 w-full rounded-full border-2 border-mint-deep px-4 py-2 text-sm font-medium text-offwhite disabled:opacity-50"
          >
            {loggingOut ? t("signingOut") : t("signOut")}
          </button>
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside aria-label="Admin navigation" className="fixed inset-y-0 inset-inline-start-0 z-10 hidden w-64 flex-col bg-forest px-4 py-6 lg:flex">
        <div className="flex items-center justify-between gap-2 px-3">
          <p className="font-display text-lg font-bold text-offwhite">
            {t("brand")}
            <span className="text-spring">.</span>
            {t("brandSuffix")}
          </p>
          <AdminLocaleSwitcher className="rounded-full border-2 border-mint-deep px-2.5 py-1 text-xs font-medium text-offwhite transition-colors hover:border-offwhite" />
        </div>
        <div className="mt-8 flex-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-6 rounded-full border-2 border-mint-deep px-4 py-2 text-sm font-medium text-offwhite transition-colors hover:border-offwhite hover:bg-forest-soft disabled:opacity-50"
        >
          {loggingOut ? t("signingOut") : t("signOut")}
        </button>
      </aside>
    </>
  );
}
