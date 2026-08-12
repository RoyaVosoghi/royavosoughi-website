"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { LeadStatus } from "@/lib/admin/queries";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-forest/10 text-forest",
  contacted: "bg-mint text-emerald",
  qualified: "bg-spring/20 text-emerald",
  converted: "bg-emerald/20 text-emerald",
  lost: "bg-saffron/15 text-saffron-deep",
};

export function LeadStatusSelect({ id, status }: { id: string; status: LeadStatus }) {
  const router = useRouter();
  const t = useTranslations("leads.statusSelect");
  const [pending, setPending] = useState(false);

  async function onChange(next: LeadStatus) {
    setPending(true);
    await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
    setPending(false);
  }

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => onChange(e.target.value as LeadStatus)}
      className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold capitalize disabled:opacity-50 ${STATUS_STYLES[status]}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(s)}
        </option>
      ))}
    </select>
  );
}
