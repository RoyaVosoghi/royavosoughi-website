"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { CampaignEmail } from "@/lib/admin/crm-docs";

import { Notice, Spinner, StatusChip, cardClass, dangerButton, formatWhen, inputClass, primaryButton, secondaryButton, textareaClass } from "./ui";

type Progress = { kind: "generate" | "send"; done: number; total: number } | null;

const CONTEXT_KEYS = ["challenge", "dealTitle", "company", "status", "customerInsight", "aiAssessment", "notes", "closedAt", "firstContact", "source"];

function contextSummary(context: Record<string, unknown>): Array<[string, string]> {
  return CONTEXT_KEYS.flatMap((key) => {
    const value = context[key];
    if (value === null || value === undefined || value === "") return [];
    const text = typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : String(value);
    return [[key, text.length > 220 ? `${text.slice(0, 220)}…` : text] as [string, string]];
  });
}

export function CampaignReview({
  campaignId,
  initialEmails,
  emailConfigured,
  canEdit,
}: {
  campaignId: string;
  initialEmails: CampaignEmail[];
  emailConfigured: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("campaigns");
  const tc = useTranslations("crmDocs");
  const [emails, setEmails] = useState(initialEmails);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);

  const patchLocal = (id: string, patch: Partial<CampaignEmail>) => setEmails((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const base = `/api/admin/campaigns/${campaignId}/emails`;

  async function generate(email: CampaignEmail): Promise<boolean> {
    const response = await fetch(`${base}/${email.id}/generate`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error === "ai_not_configured" ? tc("errors.ai_not_configured") : data.error === "ai_no_credits" ? tc("errors.ai_no_credits") : tc("errors.ai_failed"));
      return false;
    }
    patchLocal(email.id, { subject: data.subject, bodyText: data.bodyText, status: "ready", error: null });
    return true;
  }

  async function send(email: CampaignEmail): Promise<boolean> {
    const response = await fetch(`${base}/${email.id}/send`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      patchLocal(email.id, { status: data.error === "send_failed" ? "failed" : email.status });
      setError(data.error === "email_not_configured" ? tc("errors.email_not_configured") : tc("errors.send_failed"));
      return false;
    }
    patchLocal(email.id, { status: "sent", sentAt: new Date().toISOString() });
    return true;
  }

  async function runOne(email: CampaignEmail, action: (e: CampaignEmail) => Promise<boolean>) {
    setBusyId(email.id);
    setError(null);
    await action(email);
    setBusyId(null);
  }

  /** Sequential on purpose — one request per recipient keeps every call well inside the function time limit. */
  async function runAll(kind: "generate" | "send") {
    const targets = emails.filter((e) => (kind === "generate" ? e.status === "pending" : e.status === "ready"));
    if (!targets.length) return;
    if (kind === "send" && !window.confirm(t("confirmSendAll", { count: targets.length }))) return;
    setError(null);
    setProgress({ kind, done: 0, total: targets.length });
    for (const [i, email] of targets.entries()) {
      setBusyId(email.id);
      const ok = await (kind === "generate" ? generate(email) : send(email));
      setProgress({ kind, done: i + 1, total: targets.length });
      if (!ok && kind === "send") break;
    }
    setBusyId(null);
    setProgress(null);
    router.refresh();
  }

  async function save(email: CampaignEmail, patch: { subject?: string; bodyText?: string; status?: "ready" | "skipped" | "pending" }) {
    setBusyId(email.id);
    const response = await fetch(`${base}/${email.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusyId(null);
    if (!response.ok) {
      setError(tc("errors.generic"));
      return;
    }
    const nextStatus = patch.status === "ready" && !(patch.subject ?? email.subject) ? "pending" : (patch.status ?? email.status);
    patchLocal(email.id, { ...patch, status: nextStatus });
  }

  async function deleteCampaign() {
    if (!window.confirm(t("confirmDelete"))) return;
    const response = await fetch(`/api/admin/campaigns/${campaignId}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/admin/campaigns");
      router.refresh();
    } else setError(tc("errors.generic"));
  }

  const pending = emails.filter((e) => e.status === "pending").length;
  const ready = emails.filter((e) => e.status === "ready").length;

  return (
    <div className="flex flex-col gap-5">
      {!emailConfigured ? (
        <Notice tone="warn">
          <strong>{t("emailMissingTitle")}.</strong> {t("emailMissingBody")}
        </Notice>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => runAll("generate")} disabled={progress !== null || pending === 0} className={secondaryButton}>
            {progress?.kind === "generate" ? <Spinner /> : null}
            {progress?.kind === "generate" ? t("generating", { done: progress.done, total: progress.total }) : `${t("generateAll")} (${pending})`}
          </button>
          <button type="button" onClick={() => runAll("send")} disabled={progress !== null || ready === 0 || !emailConfigured} className={primaryButton}>
            {progress?.kind === "send" ? <Spinner /> : null}
            {progress?.kind === "send" ? t("sendingAll", { done: progress.done, total: progress.total }) : t("sendAll", { count: ready })}
          </button>
          <button type="button" onClick={deleteCampaign} disabled={progress !== null} className={`${dangerButton} ms-auto`}>
            {t("deleteCampaign")}
          </button>
        </div>
      ) : null}

      {progress ? (
        <div className="h-2 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full bg-cobalt transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
        </div>
      ) : null}

      {error ? <Notice tone="warn">{error}</Notice> : null}

      {emails.map((email) => (
        <EmailCard
          key={email.id}
          email={email}
          locale={locale}
          busy={busyId === email.id}
          disabled={progress !== null}
          canEdit={canEdit}
          emailConfigured={emailConfigured}
          onGenerate={() => runOne(email, generate)}
          onSend={() => runOne(email, send)}
          onSave={(patch) => save(email, patch)}
        />
      ))}
    </div>
  );
}

function EmailCard({
  email,
  locale,
  busy,
  disabled,
  canEdit,
  emailConfigured,
  onGenerate,
  onSend,
  onSave,
}: {
  email: CampaignEmail;
  locale: string;
  busy: boolean;
  disabled: boolean;
  canEdit: boolean;
  emailConfigured: boolean;
  onGenerate: () => void;
  onSend: () => void;
  onSave: (patch: { subject?: string; bodyText?: string; status?: "ready" | "skipped" | "pending" }) => void;
}) {
  const t = useTranslations("campaigns");
  const tc = useTranslations("crmDocs");
  const [subject, setSubject] = useState(email.subject ?? "");
  const [body, setBody] = useState(email.bodyText ?? "");
  const [synced, setSynced] = useState({ subject: email.subject, body: email.bodyText });

  // A fresh AI draft replaces local text (but never while the admin is mid-edit of an older draft they changed).
  if (synced.subject !== email.subject || synced.body !== email.bodyText) {
    setSynced({ subject: email.subject, body: email.bodyText });
    setSubject(email.subject ?? "");
    setBody(email.bodyText ?? "");
  }

  const edited = subject !== (email.subject ?? "") || body !== (email.bodyText ?? "");
  const sent = email.status === "sent";
  const editable = canEdit && !sent && !disabled;
  const docDir = email.locale === "fa" ? "rtl" : "ltr";

  return (
    <article className={`${cardClass} ${email.status === "skipped" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-display text-base font-bold text-ink" dir="auto">
          {email.toName}
        </p>
        <span dir="ltr" className="text-sm text-ink/55">
          {email.toEmail}
        </span>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold uppercase text-ink/55">{email.locale}</span>
        <StatusChip status={email.status} label={tc(`status.${email.status}`)} />
        {email.sentAt && sent ? <span className="text-xs text-ink/50">{t("sentOn", { when: formatWhen(email.sentAt, locale) })}</span> : null}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-ink/55">{t("context")}</summary>
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[9rem_1fr]">
          {contextSummary(email.context).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-xs text-ink/45">{key}</dt>
              <dd className="text-ink/80" dir="auto">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </details>

      {email.error && email.status === "failed" ? <p className="mt-2 text-xs text-amber-deep">{email.error}</p> : null}

      {email.subject || email.status !== "pending" ? (
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink/60">{t("subject")}</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} className={inputClass} dir={docDir} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink/60">{t("bodyLabel")}</span>
            <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} disabled={!editable} className={textareaClass} dir={docDir} />
          </label>
        </div>
      ) : null}

      {canEdit && !sent ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {busy ? <Spinner className="text-cobalt" /> : null}
          {edited ? (
            <button type="button" onClick={() => onSave({ subject, bodyText: body, status: "ready" })} disabled={busy || disabled || !subject.trim() || !body.trim()} className={secondaryButton}>
              {tc("save")}
            </button>
          ) : null}
          <button type="button" onClick={onGenerate} disabled={busy || disabled || email.status === "skipped"} className={secondaryButton}>
            {busy ? t("writing") : email.subject ? t("regenerate") : t("generate")}
          </button>
          {email.status === "skipped" ? (
            <button type="button" onClick={() => onSave({ status: "ready" })} disabled={busy || disabled} className={secondaryButton}>
              {t("unskip")}
            </button>
          ) : (
            <button type="button" onClick={() => onSave({ status: "skipped" })} disabled={busy || disabled} className={secondaryButton}>
              {t("skip")}
            </button>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={busy || disabled || edited || !emailConfigured || !(email.status === "ready" || email.status === "failed")}
            className={`${primaryButton} ms-auto`}
          >
            {t("send")}
          </button>
        </div>
      ) : null}
    </article>
  );
}
