"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function PauseBotButton({ id, paused }: { id: string; paused: boolean }) {
  const router = useRouter();
  const t = useTranslations("conversations.pauseButton");
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    await fetch(`/api/admin/conversations/${id}/pause`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: !paused }),
    });
    router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        paused
          ? "border-amber bg-amber/15 text-amber-soft hover:bg-amber/25"
          : "border-soft/15 text-soft/60 hover:bg-soft/5"
      }`}
    >
      {paused ? t("resume") : t("pause")}
    </button>
  );
}
