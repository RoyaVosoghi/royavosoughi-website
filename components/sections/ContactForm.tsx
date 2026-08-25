"use client";

import { useState, type FocusEvent, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";

type Status = "idle" | "sending" | "sent" | "error";
type FieldName = "name" | "email" | "message";
type FieldErrors = Partial<Record<FieldName, string>>;

const validatedFields = ["name", "email", "message"] as const;

function fieldClass(invalid: boolean) {
  return (
    "w-full rounded-2xl border-2 bg-offwhite px-4 py-3.5 text-ink " +
    "transition-colors placeholder:text-ink/35 focus:outline-none " +
    (invalid
      ? "border-saffron-deep focus:border-saffron-deep"
      : "border-forest/15 hover:border-forest/30 focus:border-emerald")
  );
}

export function ContactForm({
  configured,
  email,
}: {
  configured: boolean;
  email: string;
}) {
  const t = useTranslations("contact");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});

  const errorMessages: Record<FieldName, string> = {
    name: t("nameError"),
    email: t("emailError"),
    message: t("messageError"),
  };

  /** Native constraint validation (required / minLength / type=email) drives the message
   *  we already show per field — no hand-rolled regex to keep in sync with the markup. */
  function validateField(el: HTMLInputElement | HTMLTextAreaElement) {
    const name = el.name as FieldName;
    const valid = el.validity.valid;
    setErrors((prev) => {
      const next = { ...prev };
      if (valid) delete next[name];
      else next[name] = errorMessages[name];
      return next;
    });
    return valid;
  }

  function onBlur(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    validateField(event.currentTarget);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    let firstInvalid: HTMLInputElement | HTMLTextAreaElement | null = null;
    let hasError = false;
    for (const name of validatedFields) {
      const el = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (!el) continue;
      const valid = validateField(el);
      if (!valid) {
        hasError = true;
        firstInvalid ??= el;
      }
    }

    if (hasError) {
      firstInvalid?.focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    setStatus("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, locale }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setStatus("sent");
      setErrors({});
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  /**
   * Announces status changes to screen readers independently of whichever
   * branch below is on screen, since the visual content around it gets
   * swapped out wholesale (fallback / form / success).
   */
  const liveMessage =
    status === "sending"
      ? t("sending")
      : status === "sent"
        ? t("successTitle")
        : status === "error"
          ? t("errorBody")
          : "";

  const statusAnnouncer = (
    <div aria-live="polite" role="status" className="sr-only">
      {liveMessage}
    </div>
  );

  /**
   * No database yet → do not show a form that silently drops messages.
   * A plain mailto: link is honest and actually works.
   */
  if (!configured) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-forest/20 bg-mint/50 p-8">
        <p className="text-lg text-ink/80">{t("fallbackIntro")}</p>
        <a
          href={`mailto:${email}`}
          className="mt-5 inline-block text-xl font-semibold text-emerald underline underline-offset-4 hover:text-forest"
        >
          {email}
        </a>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div className="rounded-3xl bg-mint p-8 text-center">
        {statusAnnouncer}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="mx-auto h-12 w-12"
          fill="none"
          stroke="var(--color-emerald)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M7.5 12.5 L10.5 15.5 L16.5 9" />
        </svg>
        <h3 className="mt-4 text-2xl text-forest">{t("successTitle")}</h3>
        <p className="mt-2 text-ink/75">{t("successBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {statusAnnouncer}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-2 block font-medium text-forest">
            {t("nameLabel")}
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            autoComplete="name"
            onBlur={onBlur}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={fieldClass(Boolean(errors.name))}
            placeholder={t("namePlaceholder")}
          />
          {errors.name ? (
            <p id="name-error" role="alert" className="mt-1.5 text-sm font-medium text-saffron-deep">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="email" className="mb-2 block font-medium text-forest">
            {t("emailLabel")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            onBlur={onBlur}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={fieldClass(Boolean(errors.email))}
            placeholder="name@company.com"
          />
          {errors.email ? (
            <p id="email-error" role="alert" className="mt-1.5 text-sm font-medium text-saffron-deep">
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="company" className="mb-2 block font-medium text-forest">
          {t("companyLabel")}{" "}
          <span className="font-normal text-ink/70">{t("optional")}</span>
        </label>
        <input
          id="company"
          name="company"
          autoComplete="organization"
          className={fieldClass(false)}
          placeholder={t("companyPlaceholder")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="businessStage"
            className="mb-2 block font-medium text-forest"
          >
            {t("businessStageLabel")}{" "}
            <span className="font-normal text-ink/70">{t("optional")}</span>
          </label>
          <select
            id="businessStage"
            name="businessStage"
            defaultValue=""
            className={fieldClass(false)}
          >
            <option value="">{t("selectPlaceholder")}</option>
            <option value="idea">{t("businessStageOptions.idea")}</option>
            <option value="early">{t("businessStageOptions.early")}</option>
            <option value="growing">{t("businessStageOptions.growing")}</option>
            <option value="established">
              {t("businessStageOptions.established")}
            </option>
          </select>
        </div>
        <div>
          <label
            htmlFor="preferredTime"
            className="mb-2 block font-medium text-forest"
          >
            {t("preferredTimeLabel")}{" "}
            <span className="font-normal text-ink/70">{t("optional")}</span>
          </label>
          <select
            id="preferredTime"
            name="preferredTime"
            defaultValue=""
            className={fieldClass(false)}
          >
            <option value="">{t("selectPlaceholder")}</option>
            <option value="morning">{t("preferredTimeOptions.morning")}</option>
            <option value="afternoon">
              {t("preferredTimeOptions.afternoon")}
            </option>
            <option value="evening">{t("preferredTimeOptions.evening")}</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="message" className="mb-2 block font-medium text-forest">
          {t("messageLabel")}
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          rows={5}
          onBlur={onBlur}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : undefined}
          className={`${fieldClass(Boolean(errors.message))} resize-y`}
          placeholder={t("messagePlaceholder")}
        />
        {errors.message ? (
          <p id="message-error" role="alert" className="mt-1.5 text-sm font-medium text-saffron-deep">
            {errors.message}
          </p>
        ) : null}
      </div>

      {/* Honeypot — hidden from people, tempting to bots. Never remove. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Button type="submit" disabled={status === "sending"}>
          {status === "sending" ? t("sending") : t("submit")}
        </Button>
        {status === "error" ? (
          <p role="alert" className="text-sm font-medium text-saffron-deep">
            {t("errorBody")}{" "}
            <a
              href={`mailto:${email}`}
              className="underline underline-offset-4"
            >
              {email}
            </a>
          </p>
        ) : null}
      </div>
    </form>
  );
}
