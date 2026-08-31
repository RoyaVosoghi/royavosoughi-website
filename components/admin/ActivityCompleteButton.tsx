"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function ActivityCompleteButton({ id, completed }: { id: string; completed: boolean }) {
  const router = useRouter();
  const t = useTranslations("activities");
  const [pending, setPending] = useState(false);

  async function complete() {
    setPending(true);
    await fetch(`/api/admin/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    router.refresh();
    setPending(false);
  }

  if (completed) {
    return <span className="rounded-full bg-emerald/15 px-2.5 py-1 text-xs font-semibold text-emerald">{t("doneBadge")}</span>;
  }

  return (
    <button
      type="button"
      onClick={complete}
      disabled={pending}
      className="rounded-full border-2 border-forest/15 px-2.5 py-1 text-xs font-medium text-forest transition-colors hover:bg-mint/40 disabled:opacity-50"
    >
      {pending ? t("completing") : t("completeButton")}
    </button>
  );
}
