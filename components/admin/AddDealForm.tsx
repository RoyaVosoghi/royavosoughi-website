"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { Contact } from "@/lib/admin/queries";

export function AddDealForm({ contacts, defaultStageId }: { contacts: Contact[]; defaultStageId: string }) {
  const router = useRouter();
  const t = useTranslations("deals.addForm");
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  async function submit() {
    setStatus("submitting");
    const response = await fetch("/api/admin/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        pipelineStageId: defaultStageId,
        title,
        amountCents: amount ? Math.round(Number(amount) * 100) : 0,
      }),
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    setTitle("");
    setAmount("");
    setStatus("idle");
    router.refresh();
  }

  if (contacts.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-navy/10 bg-canvas p-6">
        <h2 className="font-display text-lg font-bold text-navy">{t("title")}</h2>
        <p className="mt-3 text-sm text-navy/50">{t("noContacts")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-2 border-navy/10 bg-canvas p-6">
      <h2 className="font-display text-lg font-bold text-navy">{t("title")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <select
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="rounded-2xl border-2 border-navy/15 bg-canvas px-4 py-2.5 text-navy focus:border-coral focus:outline-none"
        >
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={t("titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-2xl border-2 border-navy/15 bg-canvas px-4 py-2.5 text-navy focus:border-coral focus:outline-none"
        />
        <input
          type="number"
          min={0}
          placeholder={t("amountPlaceholder")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-2xl border-2 border-navy/15 bg-canvas px-4 py-2.5 text-navy focus:border-coral focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={status === "submitting" || !title || !contactId}
          className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-coral-soft disabled:opacity-50"
        >
          {status === "submitting" ? t("adding") : t("addButton")}
        </button>
      </div>
      {status === "error" ? <p className="mt-3 text-sm font-medium text-amber-deep">{t("errorGeneric")}</p> : null}
    </div>
  );
}
