"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ActivityType } from "@/lib/admin/queries";

const TYPES: ActivityType[] = ["call", "meeting", "note", "task"];

export function ActivityQuickAddForm({ contactId, dealId }: { contactId: string; dealId?: string | null }) {
  const router = useRouter();
  const t = useTranslations("activities");
  const [type, setType] = useState<ActivityType>("note");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  async function submit() {
    setStatus("submitting");
    const response = await fetch("/api/admin/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, dealId: dealId ?? null, type, subject }),
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    setSubject("");
    setStatus("idle");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as ActivityType)}
        className="rounded-xl border-2 border-forest/15 bg-offwhite px-2.5 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
      >
        {TYPES.map((ty) => (
          <option key={ty} value={ty}>
            {t(`type${ty.charAt(0).toUpperCase()}${ty.slice(1)}` as "typeCall" | "typeMeeting" | "typeNote" | "typeTask")}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder={t("addForm.subjectPlaceholder")}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="min-w-[200px] flex-1 rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={status === "submitting" || !subject}
        className="rounded-full bg-emerald px-4 py-2 text-xs font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
      >
        {status === "submitting" ? t("addForm.adding") : t("addForm.addButton")}
      </button>
      {status === "error" ? <span className="text-xs text-saffron-deep">{t("addForm.errorGeneric")}</span> : null}
    </div>
  );
}
