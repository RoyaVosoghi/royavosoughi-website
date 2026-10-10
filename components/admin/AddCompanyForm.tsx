"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function AddCompanyForm() {
  const router = useRouter();
  const t = useTranslations("companies.addForm");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  async function submit() {
    setStatus("submitting");
    const response = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, domain: domain || null }),
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    setName("");
    setDomain("");
    setStatus("idle");
    router.refresh();
  }

  return (
    <div className="rounded-3xl border-2 border-ink/10 bg-canvas p-6">
      <h2 className="font-display text-lg font-bold text-ink">{t("title")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border-2 border-ink/15 bg-canvas px-4 py-2.5 text-ink focus:border-cobalt focus:outline-none"
        />
        <input
          type="text"
          placeholder={t("domainPlaceholder")}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-2xl border-2 border-ink/15 bg-canvas px-4 py-2.5 text-ink focus:border-cobalt focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={status === "submitting" || !name}
          className="rounded-full bg-cobalt px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cobalt-dark disabled:opacity-50"
        >
          {status === "submitting" ? t("adding") : t("addButton")}
        </button>
      </div>
      {status === "error" ? <p className="mt-3 text-sm font-medium text-amber-deep">{t("errorGeneric")}</p> : null}
    </div>
  );
}
