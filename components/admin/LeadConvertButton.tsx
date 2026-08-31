"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function LeadConvertButton({ id, companyName }: { id: string; companyName: string | null }) {
  const router = useRouter();
  const t = useTranslations("leads.convert");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function convert() {
    const input = prompt(t("companyNamePrompt"), companyName ?? "");
    if (input === null) return;

    setPending(true);
    setError(false);
    const response = await fetch(`/api/admin/leads/${id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: input.trim() || null }),
    });
    setPending(false);

    if (!response.ok) {
      setError(true);
      return;
    }

    const body = await response.json();
    router.push(`/admin/contacts/${body.contact.id}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={convert}
        disabled={pending}
        className="rounded-full bg-emerald px-3 py-1 text-xs font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
      >
        {pending ? t("converting") : t("button")}
      </button>
      {error ? <span className="text-xs text-saffron-deep">{t("convertFailed")}</span> : null}
    </div>
  );
}
