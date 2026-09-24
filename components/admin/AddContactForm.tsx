"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function AddContactForm() {
  const router = useRouter();
  const t = useTranslations("contacts.addForm");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  async function submit() {
    setStatus("submitting");
    const response = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    setName("");
    setEmail("");
    setStatus("idle");
    router.refresh();
  }

  return (
    <div className="rounded-3xl border-2 border-navy/10 bg-canvas p-6">
      <h2 className="font-display text-lg font-bold text-navy">{t("title")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border-2 border-navy/15 bg-canvas px-4 py-2.5 text-navy focus:border-coral focus:outline-none"
        />
        <input
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border-2 border-navy/15 bg-canvas px-4 py-2.5 text-navy focus:border-coral focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={status === "submitting" || !name || !email}
          className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-coral-soft disabled:opacity-50"
        >
          {status === "submitting" ? t("adding") : t("addButton")}
        </button>
      </div>
      {status === "error" ? <p className="mt-3 text-sm font-medium text-amber-deep">{t("errorGeneric")}</p> : null}
    </div>
  );
}
