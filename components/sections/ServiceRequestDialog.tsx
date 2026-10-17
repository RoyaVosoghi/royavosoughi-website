"use client";

import { useRef, useState, type FocusEvent, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { serviceKeys, type ServiceKey } from "@/lib/service-options";

type Status = "idle" | "sending" | "sent" | "error";
type FieldName = "name" | "business" | "contact" | "email" | "message";
type FieldElement = HTMLInputElement | HTMLTextAreaElement;

/** On-screen order — the first invalid field gets focus. */
const fields: FieldName[] = ["name", "business", "contact", "email", "message"];

function fieldClass(invalid: boolean) {
  return (
    "w-full rounded-2xl border-2 bg-canvas px-4 py-3 text-ink " +
    "transition-colors placeholder:text-ink/35 focus:outline-none " +
    (invalid
      ? "border-amber-deep focus:border-amber-deep"
      : "border-ink/15 hover:border-ink/30 focus:border-cobalt")
  );
}

/**
 * The "Register / Request" button on a service card, plus the modal form it
 * opens. Uses a native <dialog> so focus trapping, Esc-to-close and the
 * backdrop come from the browser. The card's service is pre-selected but the
 * visitor can still switch it.
 */
export function ServiceRequestDialog({
  service,
  email,
}: {
  service: ServiceKey;
  email: string;
}) {
  const t = useTranslations("services");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const prefix = `req-${service}`;

  function open() {
    if (status === "sent") setStatus("idle");
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  /** Native constraint validation (required / minLength / type=email) decides validity. */
  function validateField(el: FieldElement) {
    const name = el.name as FieldName;
    const valid = el.validity.valid;
    const message =
      name === "email" && !el.validity.valueMissing ? t("form.emailError") : t("form.requiredError");
    setErrors((prev) => {
      const next = { ...prev };
      if (valid) delete next[name];
      else next[name] = message;
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
    for (const name of fields) {
      const el = form.elements.namedItem(name) as FieldElement | null;
      if (el && !validateField(el)) firstInvalid ??= el;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    setStatus("sending");
    try {
      const response = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (!response.ok) throw new Error(String(response.status));
      setStatus("sent");
      setErrors({});
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  function controlProps(name: FieldName) {
    const id = `${prefix}-${name}`;
    return {
      id,
      name,
      required: true,
      onBlur,
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? `${id}-error` : undefined,
      className: fieldClass(Boolean(errors[name])),
    };
  }

  function field(name: FieldName, label: string, control: ReactNode) {
    const id = `${prefix}-${name}`;
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block font-medium text-ink">
          {label}
        </label>
        {control}
        {errors[name] ? (
          <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-amber-deep">
            {errors[name]}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <Button type="button" onClick={open}>
        {t("cta")}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${prefix}-title`}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl bg-canvas p-0 text-ink shadow-[0_28px_56px_-20px_rgba(30,30,30,0.5)] backdrop:bg-black/60"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2 id={`${prefix}-title`} className="text-2xl text-ink">
              {t("form.title")}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t("form.close")}
              className="-m-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-mist hover:text-ink"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6 L18 18 M18 6 L6 18" />
              </svg>
            </button>
          </div>

          <div aria-live="polite" role="status" className="sr-only">
            {status === "sending" ? t("form.sending") : status === "sent" ? t("form.successBody") : ""}
          </div>

          {status === "sent" ? (
            <div className="mt-6 rounded-3xl bg-mist p-8 text-center">
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
              <h3 className="mt-4 text-xl text-ink">{t("form.successTitle")}</h3>
              <p className="mt-2 text-ink/75">{t("form.successBody")}</p>
              <div className="mt-6">
                <Button type="button" variant="secondary" onClick={close}>
                  {t("form.close")}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
              <p className="text-sm text-ink/70">{t("form.requiredNote")}</p>

              <div>
                <label htmlFor={`${prefix}-service`} className="mb-1.5 block font-medium text-ink">
                  {t("form.serviceLabel")}
                </label>
                <select
                  id={`${prefix}-service`}
                  name="service"
                  defaultValue={service}
                  className={fieldClass(false)}
                >
                  {serviceKeys.map((key) => (
                    <option key={key} value={key}>
                      {t(`items.${key}.name`)}
                    </option>
                  ))}
                </select>
              </div>

              {field("name", t("form.nameLabel"), <input {...controlProps("name")} minLength={2} autoComplete="name" />)}
              {field(
                "business",
                t("form.businessLabel"),
                <input {...controlProps("business")} autoComplete="organization" />,
              )}
              {field(
                "contact",
                t("form.contactLabel"),
                <input
                  {...controlProps("contact")}
                  minLength={3}
                  autoComplete="tel"
                  dir="ltr"
                  placeholder={t("form.contactPlaceholder")}
                />,
              )}
              {field(
                "email",
                t("form.emailLabel"),
                <input
                  {...controlProps("email")}
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  placeholder="name@company.com"
                />,
              )}
              {field(
                "message",
                t("form.messageLabel"),
                <textarea
                  {...controlProps("message")}
                  minLength={5}
                  rows={4}
                  className={`${fieldClass(Boolean(errors.message))} resize-y`}
                />,
              )}

              {/* Honeypot — hidden from people, tempting to bots. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor={`${prefix}-website`}>Website</label>
                <input id={`${prefix}-website`} name="website" tabIndex={-1} autoComplete="off" />
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={status === "sending"}>
                  {status === "sending" ? t("form.sending") : t("form.submit")}
                </Button>
                {status === "error" ? (
                  <p role="alert" className="mt-3 text-sm font-medium text-amber-deep">
                    {t("form.errorBody")}{" "}
                    <a href={`mailto:${email}`} className="underline underline-offset-4">
                      {email}
                    </a>
                  </p>
                ) : null}
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
