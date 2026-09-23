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
    <div className="rounded-3xl border-2 border-soft/10 bg-indigo p-6">
      <h2 className="font-display text-lg font-bold text-soft">{t("title")}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border-2 border-soft/15 bg-indigo px-4 py-2.5 text-soft focus:border-cyan focus:outline-none"
        />
        <input
          type="text"
          placeholder={t("domainPlaceholder")}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-2xl border-2 border-soft/15 bg-indigo px-4 py-2.5 text-soft focus:border-cyan focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={status === "submitting" || !name}
          className="rounded-full bg-cyan px-6 py-2.5 text-sm font-semibold text-indigo transition-colors hover:bg-soft disabled:opacity-50"
        >
          {status === "submitting" ? t("adding") : t("addButton")}
        </button>
      </div>
      {status === "error" ? <p className="mt-3 text-sm font-medium text-amber-soft">{t("errorGeneric")}</p> : null}
    </div>
  );
}
