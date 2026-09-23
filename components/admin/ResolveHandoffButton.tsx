"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function ResolveHandoffButton({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter();
  const t = useTranslations("handoffs.resolveButton");
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    await fetch(`/api/admin/handoffs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !resolved }),
    });
    router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
        resolved
          ? "bg-soft/10 text-soft/60 hover:bg-soft/15"
          : "bg-amber/20 text-amber-soft hover:bg-amber/30"
      }`}
    >
      {resolved ? t("resolved") : t("markResolved")}
    </button>
  );
}
