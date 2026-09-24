"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ContactStatus } from "@/lib/admin/queries";

const STATUSES: ContactStatus[] = ["active", "customer", "inactive"];

const STATUS_STYLES: Record<ContactStatus, string> = {
  active: "bg-navy/10 text-navy",
  customer: "bg-coral/20 text-coral-deep",
  inactive: "bg-navy/10 text-navy/60",
};

export function ContactStatusSelect({ id, status }: { id: string; status: ContactStatus }) {
  const router = useRouter();
  const t = useTranslations("contacts.statusSelect");
  const [pending, setPending] = useState(false);

  async function onChange(next: ContactStatus) {
    setPending(true);
    await fetch(`/api/admin/contacts/${id}`, {
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
      onChange={(e) => onChange(e.target.value as ContactStatus)}
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
