"use client";

import { useState, type FocusEvent, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { contactSelects, type ContactSelect } from "@/lib/contact-options";

type Status = "idle" | "sending" | "sent" | "error";
type FieldName =
  | "name"
  | "email"
  | "company"
  | "message"
  | Exclude<ContactSelect, "preferredTime">;
type FieldErrors = Partial<Record<FieldName, string>>;
type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Every field the visitor must answer, in on-screen order (first invalid gets focus). */
const validatedFields: FieldName[] = [
  "name",
  "email",
  "role",
  "company",
  "industry",
  "companySize",
  "businessStage",
  "needType",
  "message",
  "currentApproach",
  "timeline",
  "budget",
];

function fieldClass(invalid: boolean) {
  return (
    "w-full rounded-2xl border-2 bg-canvas px-4 py-3.5 text-ink " +
    "transition-colors placeholder:text-ink/35 focus:outline-none " +
    (invalid
      ? "border-amber-deep focus:border-amber-deep"
      : "border-ink/15 hover:border-ink/30 focus:border-cobalt")
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

  function errorMessage(name: FieldName) {
    if (name === "name") return t("nameError");
    if (name === "email") return t("emailError");
    if (name === "company") return t("companyError");
    if (name === "message") return t("messageError");
    return t("selectError");
  }

  /** Native constraint validation (required / minLength / type=email) drives the message
   *  we already show per field — no hand-rolled regex to keep in sync with the markup. */
  function validateField(el: FieldElement) {
    const name = el.name as FieldName;
    const valid = el.validity.valid;
    setErrors((prev) => {
      const next = { ...prev };
      if (valid) delete next[name];
      else next[name] = errorMessage(name);
      return next;
    });
    return valid;
  }

  function onBlur(event: FocusEvent<FieldElement>) {
    validateField(event.currentTarget);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    let firstInvalid: FieldElement | null = null;
    let hasError = false;
    for (const name of validatedFields) {
      const el = form.elements.namedItem(name) as FieldElement | null;
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

  /** Label + control + inline error, shared by every field below. */
  function field(
    name: FieldName | "preferredTime",
    label: string,
    control: ReactNode,
    optional = false,
  ) {
    const error = name === "preferredTime" ? undefined : errors[name];
    return (
      <div>
        <label htmlFor={name} className="mb-2 block font-medium text-ink">
          {label}
          {optional ? (
            <>
              {" "}
              <span className="font-normal text-ink/70">{t("optional")}</span>
            </>
          ) : null}
        </label>
        {control}
        {error ? (
          <p id={`${name}-error`} role="alert" className="mt-1.5 text-sm font-medium text-amber-deep">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  function controlProps(name: FieldName) {
    return {
      id: name,
      name,
      required: true,
      onBlur,
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
      className: fieldClass(Boolean(errors[name])),
    };
  }

  function select(name: ContactSelect, optional = false) {
    const props =
      name === "preferredTime"
        ? { id: name, name, className: fieldClass(false) }
        : controlProps(name);
    return field(
      name,
      t(`${name}Label`),
      <select {...props} defaultValue="">
        <option value="" disabled={!optional}>
          {t("selectPlaceholder")}
        </option>
        {contactSelects[name].map((value) => (
          <option key={value} value={value}>
            {t(`${name}Options.${value}`)}
          </option>
        ))}
      </select>,
      optional,
    );
  }

  function group(title: string, children: ReactNode) {
    return (
      <fieldset className="space-y-5">
        <legend className="label-eyebrow mb-4 text-cobalt">{title}</legend>
        {children}
      </fieldset>
    );
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
      <div className="rounded-3xl border-2 border-dashed border-ink/20 bg-mist/50 p-8">
        <p className="text-lg text-ink/80">{t("fallbackIntro")}</p>
        <a
          href={`mailto:${email}`}
          className="mt-5 inline-block text-xl font-semibold text-cobalt underline underline-offset-4 hover:text-ink"
        >
          {email}
        </a>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div className="rounded-3xl bg-mist p-8 text-center">
        {statusAnnouncer}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="mx-auto h-12 w-12"
          fill="none"
          stroke="var(--color-cobalt)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M7.5 12.5 L10.5 15.5 L16.5 9" />
        </svg>
        <h3 className="mt-4 text-2xl text-ink">{t("successTitle")}</h3>
        <p className="mt-2 text-ink/75">{t("successBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-10">
      {statusAnnouncer}
      <p className="text-sm text-ink/70">{t("requiredNote")}</p>

      {group(
        t("groupYou"),
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {field(
              "name",
              t("nameLabel"),
              <input
                {...controlProps("name")}
                minLength={2}
                autoComplete="name"
                placeholder={t("namePlaceholder")}
              />,
            )}
            {field(
              "email",
              t("emailLabel"),
              <input
                {...controlProps("email")}
                type="email"
                autoComplete="email"
                dir="ltr"
                placeholder="name@company.com"
              />,
            )}
          </div>
          {select("role")}
        </>,
      )}

      {group(
        t("groupBusiness"),
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {field(
              "company",
              t("companyLabel"),
              <input
                {...controlProps("company")}
                minLength={2}
                autoComplete="organization"
                placeholder={t("companyPlaceholder")}
              />,
            )}
            {select("industry")}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {select("companySize")}
            {select("businessStage")}
          </div>
        </>,
      )}

      {group(
        t("groupProject"),
        <>
          {select("needType")}
          {field(
            "message",
            t("messageLabel"),
            <textarea
              {...controlProps("message")}
              minLength={30}
              rows={5}
              className={`${fieldClass(Boolean(errors.message))} resize-y`}
              placeholder={t("messagePlaceholder")}
            />,
          )}
          {select("currentApproach")}
          <div className="grid gap-5 sm:grid-cols-2">
            {select("timeline")}
            {select("budget")}
          </div>
          {select("preferredTime", true)}
        </>,
      )}

      {/* Honeypot — hidden from people, tempting to bots. Never remove. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={status === "sending"}>
          {status === "sending" ? t("sending") : t("submit")}
        </Button>
        {status === "error" ? (
          <p role="alert" className="text-sm font-medium text-amber-deep">
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
