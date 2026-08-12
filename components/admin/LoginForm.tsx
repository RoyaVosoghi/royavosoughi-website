"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "rateLimited">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.status === 429) {
        setStatus("rateLimited");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm">
      <label htmlFor="admin-email" className="mb-2 block text-sm font-medium text-ink/80">
        {t("emailLabel")}
      </label>
      <input
        id="admin-email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={status === "submitting"}
        className="w-full rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-3 text-ink transition-colors focus:border-emerald focus:outline-none"
        autoFocus
      />

      <label htmlFor="admin-password" className="mt-4 mb-2 block text-sm font-medium text-ink/80">
        {t("passwordLabel")}
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={status === "submitting"}
        className="w-full rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-3 text-ink transition-colors focus:border-emerald focus:outline-none"
      />

      {status === "error" ? (
        <p role="alert" className="mt-3 text-sm font-medium text-saffron-deep">
          {t("errorInvalid")}
        </p>
      ) : null}

      {status === "rateLimited" ? (
        <p role="alert" className="mt-3 text-sm font-medium text-saffron-deep">
          {t("errorRateLimited")}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting" || !email || !password}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald px-7 py-3.5 text-base font-semibold text-offwhite shadow-[0_2px_0_0_var(--color-forest)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest hover:shadow-[0_4px_0_0_var(--color-forest)] disabled:pointer-events-none disabled:opacity-50"
      >
        {status === "submitting" ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}
