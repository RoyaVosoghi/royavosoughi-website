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
    <div className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("title")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-2.5 text-ink focus:border-emerald focus:outline-none"
        />
        <input
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-2.5 text-ink focus:border-emerald focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={status === "submitting" || !name || !email}
          className="rounded-full bg-emerald px-6 py-2.5 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {status === "submitting" ? t("adding") : t("addButton")}
        </button>
      </div>
      {status === "error" ? <p className="mt-3 text-sm font-medium text-saffron-deep">{t("errorGeneric")}</p> : null}
    </div>
  );
}
