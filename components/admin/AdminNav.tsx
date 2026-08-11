"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/conversations", label: "Conversations" },
  { href: "/admin/handoffs", label: "Handoffs" },
  { href: "/admin/broadcast", label: "Broadcast" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/audit-log", label: "Audit log" },
  { href: "/admin/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="bg-forest">
      <div className="container-page flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-8">
          <p className="font-display text-lg font-bold text-offwhite">
            Roya<span className="text-spring">.</span>Admin
          </p>
          <nav className="flex flex-wrap items-center gap-1">
            {LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-spring text-forest"
                      : "text-mint-deep hover:bg-forest-soft hover:text-offwhite"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-full border-2 border-mint-deep px-4 py-2 text-sm font-medium text-offwhite transition-colors hover:border-offwhite hover:bg-forest-soft disabled:opacity-50"
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
