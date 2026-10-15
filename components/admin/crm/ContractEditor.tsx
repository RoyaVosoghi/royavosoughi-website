"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { A4Document, downloadBlob, type A4DocumentHandle } from "@/components/docs/A4Document";
import type { Contract } from "@/lib/admin/crm-docs";
import { buildContractMarkdown, contractToBlocks } from "@/lib/crm/contract";
import { docLabels } from "@/lib/crm/doc-labels";
import { CURRENCIES, daysSince, type DocLocale } from "@/lib/crm/format";

import type { ContactOption, DealOption } from "./ProposalEditor";
import { Field, Notice, Spinner, StatusChip, cardClass, dangerButton, formatWhen, inputClass, primaryButton, secondaryButton, textareaClass } from "./ui";

interface FormState {
  locale: DocLocale;
  title: string;
  contactId: string | null;
  dealId: string | null;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  amountCents: number;
  currency: string;
  startDate: string;
  durationLabel: string;
  bodyMd: string;
}

function initialState(contract: Contract | null, contacts: ContactOption[], deals: DealOption[], prefill: { contactId?: string; dealId?: string }): FormState {
  if (contract) {
    return {
      locale: contract.locale,
      title: contract.title,
      contactId: contract.contactId,
      dealId: contract.dealId,
      clientName: contract.clientName,
      clientEmail: contract.clientEmail,
      clientCompany: contract.clientCompany ?? "",
      amountCents: contract.amountCents,
      currency: contract.currency,
      startDate: contract.startDate ?? "",
      durationLabel: contract.durationLabel ?? "",
      bodyMd: contract.bodyMd,
    };
  }
  const deal = deals.find((d) => d.id === prefill.dealId) ?? null;
  const contact = contacts.find((c) => c.id === (prefill.contactId ?? deal?.contactId)) ?? null;
  const state: FormState = {
    locale: "en",
    title: deal?.title ?? "",
    contactId: contact?.id ?? null,
    dealId: deal?.id ?? null,
    clientName: contact?.name ?? "",
    clientEmail: contact?.email ?? "",
    clientCompany: contact?.companyName ?? "",
    amountCents: deal?.amountCents ?? 0,
    currency: deal?.currency ?? "EUR",
    startDate: "",
    durationLabel: "",
    bodyMd: "",
  };
  state.bodyMd = templateFor(state);
  return state;
}

function templateFor(form: FormState): string {
  return buildContractMarkdown({
    locale: form.locale,
    clientName: form.clientName || "[client name]",
    clientCompany: form.clientCompany || null,
    clientEmail: form.clientEmail || "[email]",
    projectTitle: form.title || "[project]",
    amountCents: form.amountCents,
    currency: form.currency,
    durationLabel: form.durationLabel,
    startDate: form.startDate || null,
  });
}

function toPayload(form: FormState) {
  return {
    locale: form.locale,
    title: form.title.trim(),
    contactId: form.contactId,
    dealId: form.dealId,
    clientName: form.clientName.trim(),
    clientEmail: form.clientEmail.trim(),
    clientCompany: form.clientCompany.trim() || null,
    bodyMd: form.bodyMd,
    amountCents: form.amountCents,
    currency: form.currency,
    startDate: form.startDate || null,
    durationLabel: form.durationLabel.trim() || null,
  };
}

export function ContractEditor({
  contract,
  contacts,
  deals,
  canEdit,
  proposalLink,
  prefill = {},
}: {
  contract: Contract | null;
  contacts: ContactOption[];
  deals: DealOption[];
  canEdit: boolean;
  proposalLink: { id: string; no: string } | null;
  prefill?: { contactId?: string; dealId?: string };
}) {
  const router = useRouter();
  const adminLocale = useLocale();
  const t = useTranslations("contracts");
  const tc = useTranslations("crmDocs");
  const docRef = useRef<A4DocumentHandle>(null);

  const [saved, setSaved] = useState<Contract | null>(contract);
  const [form, setForm] = useState<FormState>(() => initialState(contract, contacts, deals, prefill));
  const savedSnapshot = useRef(contract ? JSON.stringify(toPayload(form)) : "");
  const [busy, setBusy] = useState<null | "save" | "pdf" | "send" | "manual" | "ai" | "followup" | "status" | "delete">(null);
  const [message, setMessage] = useState<{ tone: "info" | "warn" | "success"; text: string; link?: string } | null>(null);
  const [undoBody, setUndoBody] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "followup" | null>(null);

  useEffect(() => {
    if (contract) setSaved((current) => (current && current.updatedAt >= contract.updatedAt ? current : contract));
  }, [contract]);

  const dirty = JSON.stringify(toPayload(form)) !== savedSnapshot.current;
  const locked = saved?.status === "accepted" || saved?.status === "canceled";
  const editable = canEdit && !locked;
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // ---- Preview -------------------------------------------------------------
  const deferred = useDeferredValue(form);
  const L = docLabels(deferred.locale);
  const docNo = saved?.contractNo ?? L.draftNo;
  const blocks = useMemo(
    () =>
      contractToBlocks({
        locale: deferred.locale,
        title: deferred.title,
        contractNo: docNo,
        clientName: deferred.clientName || "—",
        clientCompany: deferred.clientCompany || null,
        bodyMd: deferred.bodyMd,
        issuedAt: saved?.sentAt ?? saved?.createdAt ?? new Date().toISOString(),
        acceptedByName: saved?.acceptedByName ?? null,
        acceptedAt: saved?.acceptedAt ?? null,
        acceptedIp: saved?.acceptedIp ?? null,
      }),
    [deferred, docNo, saved],
  );
  const meta = useMemo(() => ({ locale: deferred.locale, kindLabel: L.contract, docNo }), [deferred.locale, L, docNo]);

  // ---- Actions ---------------------------------------------------------------
  function errorText(code: string | undefined): string {
    const known = ["validation_failed", "email_not_configured", "send_failed", "locked", "invalid_pdf", "ai_not_configured", "ai_failed", "ai_no_credits"] as const;
    return (known as readonly string[]).includes(code ?? "") ? tc(`errors.${code as (typeof known)[number]}`) : tc("errors.generic");
  }

  async function call(path: string, method: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { ok: response.ok, data: await response.json().catch(() => ({})) };
  }

  async function handleSave() {
    setBusy("save");
    setMessage(null);
    const payload = toPayload(form);
    const { ok, data } = await call(saved ? `/api/admin/contracts/${saved.id}` : "/api/admin/contracts", saved ? "PATCH" : "POST", payload);
    setBusy(null);
    if (!ok) {
      setMessage({ tone: "warn", text: errorText(data.error) });
      return;
    }
    savedSnapshot.current = JSON.stringify(payload);
    setSaved(data.contract);
    setUndoBody(null);
    setMessage({ tone: "success", text: tc("saved") });
    if (!saved) router.replace(`/admin/contracts/${data.contract.id}`);
    else router.refresh();
  }

  async function handleDownload() {
    setBusy("pdf");
    try {
      const { blob } = await docRef.current!.exportPdf();
      downloadBlob(blob, `${saved?.contractNo ?? "contract-draft"}${saved?.status === "accepted" ? "-signed" : ""}.pdf`);
    } catch (err) {
      console.error(err);
      setMessage({ tone: "warn", text: tc("errors.invalid_pdf") });
    } finally {
      setBusy(null);
    }
  }

  async function handleSend(manual: boolean) {
    if (!saved) return;
    setBusy(manual ? "manual" : "send");
    setMessage(null);
    try {
      let body: Record<string, unknown> = { manual: true };
      if (!manual) {
        await docRef.current!.relayout();
        const { base64 } = await docRef.current!.exportPdf();
        body = { pdfBase64: base64 };
      }
      const { ok, data } = await call(`/api/admin/contracts/${saved.id}/send`, "POST", body);
      if (!ok) {
        setMessage({ tone: "warn", text: errorText(data.error) });
        return;
      }
      if (manual) {
        await navigator.clipboard?.writeText(data.url).catch(() => undefined);
        setMessage({ tone: "success", text: tc("sentManualHint"), link: data.url });
      } else {
        setMessage({ tone: "success", text: tc("sentHint", { email: saved.clientEmail }) });
      }
      setSaved({ ...saved, status: "sent", sentAt: new Date().toISOString() });
      router.refresh();
    } catch (err) {
      console.error(err);
      setMessage({ tone: "warn", text: tc("errors.generic") });
    } finally {
      setBusy(null);
    }
  }

  async function handleRewrite() {
    if (!saved) return;
    setBusy("ai");
    setMessage(null);
    const { ok, data } = await call(`/api/admin/contracts/${saved.id}/rewrite`, "POST", { bodyMd: form.bodyMd });
    setBusy(null);
    if (!ok) {
      setMessage({ tone: "warn", text: errorText(data.error) });
      return;
    }
    setUndoBody(form.bodyMd);
    update("bodyMd", data.bodyMd);
  }

  async function handleFollowUp() {
    if (!saved) return;
    setBusy("followup");
    const { ok, data } = await call(`/api/admin/contracts/${saved.id}/follow-up`, "POST");
    setBusy(null);
    if (!ok) {
      setMessage({ tone: "warn", text: errorText(data.error) });
      return;
    }
    setFollowUp(data.message);
  }

  async function changeStatus(action: "cancel" | "reopen") {
    if (!saved) return;
    if (action === "cancel" && !window.confirm(tc("confirmCancel"))) return;
    setBusy("status");
    const { ok } = await call(`/api/admin/contracts/${saved.id}/status`, "POST", { action });
    setBusy(null);
    if (!ok) setMessage({ tone: "warn", text: tc("errors.generic") });
    else window.location.reload();
  }

  async function remove() {
    if (!saved || !window.confirm(tc("confirmDelete"))) return;
    setBusy("delete");
    const { ok } = await call(`/api/admin/contracts/${saved.id}`, "DELETE");
    setBusy(null);
    if (!ok) {
      setMessage({ tone: "warn", text: tc("errors.generic") });
      return;
    }
    router.push("/admin/contracts");
    router.refresh();
  }

  async function copy(text: string, which: "link" | "followup") {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  function insertTemplate() {
    if (form.bodyMd.trim() && !window.confirm(t("confirmTemplate"))) return;
    setUndoBody(form.bodyMd);
    update("bodyMd", templateFor(form));
  }

  function pickContact(id: string) {
    const contact = contacts.find((c) => c.id === id);
    if (!contact) {
      update("contactId", null);
      return;
    }
    setForm((f) => ({
      ...f,
      contactId: contact.id,
      dealId: f.dealId && deals.find((d) => d.id === f.dealId)?.contactId === contact.id ? f.dealId : null,
      clientName: contact.name,
      clientEmail: contact.email,
      clientCompany: contact.companyName ?? "",
    }));
  }

  function pickDeal(id: string) {
    const deal = deals.find((d) => d.id === id);
    if (!deal) {
      update("dealId", null);
      return;
    }
    if (form.contactId !== deal.contactId) pickContact(deal.contactId);
    setForm((f) => ({ ...f, dealId: deal.id, currency: deal.currency || f.currency, amountCents: f.amountCents || deal.amountCents, title: f.title || deal.title }));
  }

  const dealChoices = form.contactId ? deals.filter((d) => d.contactId === form.contactId) : deals;
  const clientUrl = saved && typeof window !== "undefined" ? `${window.location.origin}/contract/${saved.shareToken}` : "";
  const canSend = editable && Boolean(saved) && !dirty && busy === null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-canvas/95 px-1 py-2 backdrop-blur">
          {canEdit ? (
            <>
              <button type="button" onClick={handleSave} disabled={!editable || busy !== null || (Boolean(saved) && !dirty)} className={secondaryButton}>
                {busy === "save" ? <Spinner /> : null}
                {busy === "save" ? tc("saving") : tc("save")}
              </button>
              <button type="button" onClick={() => handleSend(false)} disabled={!canSend} className={primaryButton} title={dirty ? t("saveFirst") : undefined}>
                {busy === "send" ? <Spinner /> : null}
                {busy === "send" ? tc("sending") : tc("sendEmailOnly")}
              </button>
              <button type="button" onClick={() => handleSend(true)} disabled={!canSend} className={secondaryButton}>
                {busy === "manual" ? <Spinner /> : null}
                {tc("sendManual")}
              </button>
            </>
          ) : null}
          <button type="button" onClick={handleDownload} disabled={busy !== null} className={secondaryButton}>
            {busy === "pdf" ? <Spinner /> : null}
            {busy === "pdf" ? tc("preparingPdf") : tc("downloadPdf")}
          </button>
          {dirty && editable ? <span className="text-xs font-semibold text-amber-deep">● {saved ? t("saveFirst") : tc("unsaved")}</span> : null}
        </div>

        {message ? (
          <Notice tone={message.tone}>
            {message.text}
            {message.link ? (
              <span className="mt-1 block break-all font-mono text-xs" dir="ltr">
                {message.link}
              </span>
            ) : null}
          </Notice>
        ) : null}
        {!canEdit ? <Notice>{tc("readOnly")}</Notice> : null}

        {saved ? (
          <section className={cardClass}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-lg font-bold text-ink">{t("panel.title")}</h2>
              <StatusChip status={saved.status} label={tc(`status.${saved.status}`)} />
              <span dir="ltr" className="font-mono text-xs text-ink/50">
                {saved.contractNo}
              </span>
              {proposalLink ? (
                <Link href={`/admin/proposals/${proposalLink.id}`} className="text-xs font-semibold text-cobalt hover:underline">
                  {t("panel.fromProposal")} <span dir="ltr">{proposalLink.no}</span>
                </Link>
              ) : null}
            </div>
            <ul className="mt-3 flex flex-col gap-1 text-sm text-ink/75">
              {saved.sentAt ? <li>{t("panel.sentAt", { when: formatWhen(saved.sentAt, adminLocale) })}</li> : null}
              {saved.sentAt ? <li>{saved.viewedAt ? t("panel.viewedAt", { when: formatWhen(saved.viewedAt, adminLocale) }) : t("panel.notViewed")}</li> : null}
              {saved.status === "accepted" && saved.acceptedByName ? (
                <>
                  <li className="font-semibold text-cobalt">
                    {t("panel.acceptedBy", { name: saved.acceptedByName })} {t("panel.acceptedAt", { when: formatWhen(saved.acceptedAt, adminLocale) })}
                    {saved.acceptedIp ? (
                      <span className="ms-2 text-xs font-normal text-ink/50" dir="ltr">
                        {t("panel.fromIp", { ip: saved.acceptedIp })}
                      </span>
                    ) : null}
                  </li>
                  <li>{saved.acceptedCopySentAt ? t("panel.copySent", { when: formatWhen(saved.acceptedCopySentAt, adminLocale) }) : t("panel.copyNotSent")}</li>
                </>
              ) : null}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {saved.status !== "draft" ? (
                <button type="button" onClick={() => copy(clientUrl, "link")} className={secondaryButton}>
                  {copied === "link" ? tc("linkCopied") : tc("copyLink")}
                </button>
              ) : null}
              {canEdit && (saved.status === "sent" || saved.status === "viewed") ? (
                <button type="button" onClick={handleFollowUp} disabled={busy !== null} className={secondaryButton}>
                  {busy === "followup" ? <Spinner /> : null}
                  {busy === "followup" ? t("panel.followingUp") : t("panel.followUp")}
                </button>
              ) : null}
              {canEdit && saved.status !== "accepted" ? (
                saved.status === "canceled" ? (
                  <button type="button" onClick={() => changeStatus("reopen")} disabled={busy !== null} className={secondaryButton}>
                    {tc("reopenDoc")}
                  </button>
                ) : (
                  <button type="button" onClick={() => changeStatus("cancel")} disabled={busy !== null} className={secondaryButton}>
                    {tc("cancelDoc")}
                  </button>
                )
              ) : null}
              {canEdit && saved.status !== "accepted" ? (
                <button type="button" onClick={remove} disabled={busy !== null} className={dangerButton}>
                  {tc("deleteDoc")}
                </button>
              ) : null}
            </div>
            {followUp ? (
              <div className="mt-4 rounded-2xl border-2 border-cobalt/20 bg-cobalt/5 p-4">
                <p className="text-xs font-semibold text-ink/60">{t("panel.followUpHint", { days: daysSince(saved.sentAt) })}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink" dir="auto">
                  {followUp}
                </p>
                <button type="button" onClick={() => copy(followUp, "followup")} className={`${secondaryButton} mt-3`}>
                  {copied === "followup" ? t("panel.copied") : t("panel.copy")}
                </button>
              </div>
            ) : null}
            {locked && saved.status === "accepted" ? <p className="mt-3 text-xs text-ink/50">{t("lockedAccepted")}</p> : null}
          </section>
        ) : null}

        <section className={cardClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tc("docLanguage")}>
              <select value={form.locale} onChange={(e) => update("locale", e.target.value as DocLocale)} disabled={!editable} className={inputClass}>
                <option value="en">{tc("langEn")}</option>
                <option value="fa">{tc("langFa")}</option>
              </select>
            </Field>
            <Field label={tc("title")}>
              <input value={form.title} onChange={(e) => update("title", e.target.value)} disabled={!editable} className={inputClass} dir="auto" />
            </Field>
            <Field label={t("contact")}>
              <select value={form.contactId ?? ""} onChange={(e) => pickContact(e.target.value)} disabled={!editable} className={inputClass}>
                <option value="">{tc("manualEntry")}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.companyName ? ` · ${c.companyName}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tc("deal")}>
              <select value={form.dealId ?? ""} onChange={(e) => pickDeal(e.target.value)} disabled={!editable} className={inputClass}>
                <option value="">{tc("noDeal")}</option>
                {dealChoices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tc("clientName")}>
              <input value={form.clientName} onChange={(e) => update("clientName", e.target.value)} disabled={!editable} className={inputClass} dir="auto" />
            </Field>
            <Field label={tc("clientEmail")}>
              <input type="email" value={form.clientEmail} onChange={(e) => update("clientEmail", e.target.value)} disabled={!editable} className={inputClass} dir="ltr" />
            </Field>
            <Field label={tc("clientCompany")}>
              <input value={form.clientCompany} onChange={(e) => update("clientCompany", e.target.value)} disabled={!editable} className={inputClass} dir="auto" />
            </Field>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <Field label={t("amount")}>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.amountCents / 100}
                  onChange={(e) => update("amountCents", Math.max(0, Math.round(Number(e.target.value || 0) * 100)))}
                  disabled={!editable}
                  className={inputClass}
                  dir="ltr"
                />
              </Field>
              <Field label={tc("currency")}>
                <select value={form.currency} onChange={(e) => update("currency", e.target.value)} disabled={!editable} className={inputClass}>
                  {Array.from(new Set([form.currency, ...CURRENCIES])).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t("startDate")}>
              <input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} disabled={!editable} className={inputClass} />
            </Field>
            <Field label={t("duration")}>
              <input value={form.durationLabel} placeholder={t("durationPlaceholder")} onChange={(e) => update("durationLabel", e.target.value)} disabled={!editable} className={inputClass} dir="auto" />
            </Field>
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="me-auto font-display text-lg font-bold text-ink">{t("body")}</h2>
            {editable ? (
              <>
                <button type="button" onClick={insertTemplate} disabled={busy !== null} className={secondaryButton}>
                  {t("insertTemplate")}
                </button>
                <button type="button" onClick={handleRewrite} disabled={!saved || busy !== null || !form.bodyMd.trim()} className={secondaryButton}>
                  {busy === "ai" ? <Spinner /> : null}
                  {busy === "ai" ? t("aiRewriting") : t("aiRewrite")}
                </button>
              </>
            ) : null}
          </div>
          {undoBody !== null ? (
            <div className="mt-3">
              <Notice>
                {t("aiRewriteDone")}
                <button
                  type="button"
                  onClick={() => {
                    update("bodyMd", undoBody);
                    setUndoBody(null);
                  }}
                  className="font-semibold text-cobalt underline"
                >
                  {t("undo")}
                </button>
              </Notice>
            </div>
          ) : null}
          <textarea
            value={form.bodyMd}
            onChange={(e) => update("bodyMd", e.target.value)}
            disabled={!editable}
            rows={28}
            dir={form.locale === "fa" ? "rtl" : "ltr"}
            className={`${textareaClass} mt-3 font-mono text-[13px]`}
          />
          <p className="mt-2 text-xs text-ink/50">{t("bodyHint")}</p>
        </section>
      </div>

      <div className="min-w-0">
        <div className="sticky top-4 flex h-[calc(100dvh-2rem)] flex-col">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">{tc("preview")}</p>
          <A4Document
            ref={docRef}
            blocks={blocks}
            meta={meta}
            labels={{
              zoomIn: tc("viewer.zoomIn"),
              zoomOut: tc("viewer.zoomOut"),
              fit: tc("viewer.fit"),
              fullscreen: tc("viewer.fullscreen"),
              pages: (count) => tc("viewer.pages", { count }),
            }}
          />
        </div>
      </div>
    </div>
  );
}
