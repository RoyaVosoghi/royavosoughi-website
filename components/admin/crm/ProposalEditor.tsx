"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { A4Document, downloadBlob, type A4DocumentHandle } from "@/components/docs/A4Document";
import type { Proposal, ProposalComment } from "@/lib/admin/crm-docs";
import { docLabels } from "@/lib/crm/doc-labels";
import { CURRENCIES, type DocLocale } from "@/lib/crm/format";
import {
  PROPOSAL_TEMPLATE_KEYS,
  proposalTemplate,
  proposalToBlocks,
  type ProposalContent,
  type ProposalOption,
  type ProposalPhase,
  type ProposalTemplateKey,
} from "@/lib/crm/proposal";

import { ProposalPanel } from "./ProposalPanel";
import { Field, Notice, Spinner, cardClass, inputClass, primaryButton, secondaryButton, textareaClass } from "./ui";

export interface ContactOption {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
}

export interface DealOption {
  id: string;
  title: string;
  contactId: string;
  currency: string;
  amountCents: number;
}

interface FormState {
  locale: DocLocale;
  contactId: string | null;
  dealId: string | null;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  clientPhone: string;
  title: string;
  currency: string;
  validUntil: string;
  content: ProposalContent;
}

function initialState(proposal: Proposal | null, contacts: ContactOption[], deals: DealOption[], prefill: { contactId?: string; dealId?: string }): FormState {
  if (proposal) {
    return {
      locale: proposal.locale,
      contactId: proposal.contactId,
      dealId: proposal.dealId,
      clientName: proposal.clientName,
      clientEmail: proposal.clientEmail,
      clientCompany: proposal.clientCompany ?? "",
      clientPhone: proposal.clientPhone ?? "",
      title: proposal.title,
      currency: proposal.currency,
      validUntil: proposal.validUntil ?? "",
      content: proposal.content,
    };
  }
  const deal = deals.find((d) => d.id === prefill.dealId) ?? null;
  const contact = contacts.find((c) => c.id === (prefill.contactId ?? deal?.contactId)) ?? null;
  const template = proposalTemplate("custom_ai_build", "en");
  const validUntil = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  return {
    locale: "en",
    contactId: contact?.id ?? null,
    dealId: deal?.id ?? null,
    clientName: contact?.name ?? "",
    clientEmail: contact?.email ?? "",
    clientCompany: contact?.companyName ?? "",
    clientPhone: contact?.phone ?? "",
    title: deal?.title ?? template.title,
    currency: deal?.currency ?? "EUR",
    validUntil,
    content: template.content,
  };
}

const clean = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);

function toPayload(form: FormState) {
  const c = form.content;
  return {
    locale: form.locale,
    contactId: form.contactId,
    dealId: form.dealId,
    clientName: form.clientName.trim(),
    clientEmail: form.clientEmail.trim(),
    clientCompany: form.clientCompany.trim() || null,
    clientPhone: form.clientPhone.trim() || null,
    title: form.title.trim(),
    currency: form.currency,
    validUntil: form.validUntil || null,
    content: {
      ...c,
      understanding: clean(c.understanding),
      goals: clean(c.goals),
      deliverables: clean(c.deliverables),
      exclusions: clean(c.exclusions),
      assumptions: clean(c.assumptions),
      whyMe: clean(c.whyMe),
      nextSteps: clean(c.nextSteps),
      phases: c.phases.filter((p) => p.title.trim() || p.detail.trim()),
      options: c.options.map((o) => ({ ...o, features: clean(o.features) })),
    },
  };
}

type ListKey = "understanding" | "goals" | "deliverables" | "exclusions" | "assumptions" | "whyMe" | "nextSteps";
type TextKey = "intro" | "methodology" | "timelineNote" | "termsNote";

export function ProposalEditor({
  proposal,
  comments,
  contacts,
  deals,
  canEdit,
  prefill = {},
}: {
  proposal: Proposal | null;
  comments: ProposalComment[];
  contacts: ContactOption[];
  deals: DealOption[];
  canEdit: boolean;
  prefill?: { contactId?: string; dealId?: string };
}) {
  const router = useRouter();
  const t = useTranslations("proposals");
  const tc = useTranslations("crmDocs");
  const docRef = useRef<A4DocumentHandle>(null);

  const [saved, setSaved] = useState<Proposal | null>(proposal);
  const [form, setForm] = useState<FormState>(() => initialState(proposal, contacts, deals, prefill));
  const savedSnapshot = useRef(JSON.stringify(toPayload(form)));
  const [template, setTemplate] = useState<ProposalTemplateKey>("custom_ai_build");
  const [busy, setBusy] = useState<null | "save" | "pdf" | "send" | "manual">(null);
  const [message, setMessage] = useState<{ tone: "info" | "warn" | "success"; text: string; link?: string } | null>(null);
  const [renderOverride, setRenderOverride] = useState<{ docNo: string; revision: number; issuedAt: string } | null>(null);

  // A router.refresh() brings fresh server data (e.g. the client just responded): take its status/views, keep local edits.
  useEffect(() => {
    if (proposal) setSaved((current) => (current && current.updatedAt >= proposal.updatedAt ? current : proposal));
  }, [proposal]);

  const dirty = JSON.stringify(toPayload(form)) !== savedSnapshot.current;
  const locked = saved?.status === "converted" || saved?.status === "canceled";
  const editable = canEdit && !locked;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const updateContent = <K extends keyof ProposalContent>(key: K, value: ProposalContent[K]) =>
    setForm((f) => ({ ...f, content: { ...f.content, [key]: value } }));

  // ---- Live preview (deferred so typing never waits on pagination) --------
  const deferred = useDeferredValue(form);
  const L = docLabels(deferred.locale);
  const blocks = useMemo(
    () =>
      proposalToBlocks({
        locale: deferred.locale,
        title: deferred.title,
        proposalNo: renderOverride?.docNo ?? saved?.proposalNo ?? L.draftNo,
        revision: renderOverride?.revision ?? saved?.revision ?? 0,
        clientName: deferred.clientName || "—",
        clientCompany: deferred.clientCompany || null,
        clientEmail: deferred.clientEmail,
        currency: deferred.currency,
        validUntil: deferred.validUntil || null,
        issuedAt: renderOverride?.issuedAt ?? saved?.sentAt ?? saved?.createdAt ?? new Date().toISOString(),
        selectedOption: saved?.selectedOption ?? null,
        content: deferred.content,
      }),
    [deferred, renderOverride, saved, L.draftNo],
  );
  const meta = useMemo(
    () => ({ locale: deferred.locale, kindLabel: L.proposal, docNo: renderOverride?.docNo ?? saved?.proposalNo ?? L.draftNo }),
    [deferred.locale, L, renderOverride, saved],
  );

  // ---- Actions ------------------------------------------------------------
  function errorText(code: string | undefined): string {
    const known = ["validation_failed", "email_not_configured", "send_failed", "locked", "invalid_pdf"] as const;
    return (known as readonly string[]).includes(code ?? "") ? tc(`errors.${code as (typeof known)[number]}`) : tc("errors.generic");
  }

  async function save(): Promise<Proposal | null> {
    const payload = toPayload(form);
    const response = await fetch(saved ? `/api/admin/proposals/${saved.id}` : "/api/admin/proposals", {
      method: saved ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage({ tone: "warn", text: errorText(data.error) });
      return null;
    }
    savedSnapshot.current = JSON.stringify(payload);
    setSaved(data.proposal);
    return data.proposal as Proposal;
  }

  async function handleSave() {
    setBusy("save");
    setMessage(null);
    const result = await save();
    setBusy(null);
    if (!result) return;
    setMessage({ tone: "success", text: tc("saved") });
    if (!saved) router.replace(`/admin/proposals/${result.id}`);
    else router.refresh();
  }

  async function handleDownload() {
    setBusy("pdf");
    try {
      const { blob } = await docRef.current!.exportPdf();
      downloadBlob(blob, `${saved?.proposalNo ?? "proposal-draft"}.pdf`);
    } catch (err) {
      console.error(err);
      setMessage({ tone: "warn", text: tc("errors.invalid_pdf") });
    } finally {
      setBusy(null);
    }
  }

  /** Save → re-render with the real number/revision → wait for pagination → PDF → server emails it. */
  async function handleSend(manual: boolean) {
    setBusy(manual ? "manual" : "send");
    setMessage(null);
    try {
      const current = await save();
      if (!current) return;

      let body: Record<string, unknown> = { manual: true };
      if (!manual) {
        setRenderOverride({
          docNo: current.proposalNo,
          revision: current.revision + 1,
          issuedAt: new Date().toISOString(),
        });
        await docRef.current!.relayout();
        const { base64 } = await docRef.current!.exportPdf();
        body = { pdfBase64: base64 };
      }

      const response = await fetch(`/api/admin/proposals/${current.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "warn", text: errorText(data.error) });
        return;
      }
      setSaved(data.proposal);
      if (manual) {
        await navigator.clipboard?.writeText(data.url).catch(() => undefined);
        setMessage({ tone: "success", text: tc("sentManualHint"), link: data.url });
      } else {
        setMessage({
          tone: "success",
          text: `${tc("sentHint", { email: current.clientEmail })}${data.movedDeal ? ` ${tc("movedDeal")}` : ""}`,
        });
      }
      if (!saved) router.replace(`/admin/proposals/${current.id}`);
      else router.refresh();
    } catch (err) {
      console.error(err);
      setMessage({ tone: "warn", text: tc("errors.generic") });
    } finally {
      setRenderOverride(null);
      setBusy(null);
    }
  }

  function applyTemplate() {
    const hasContent = form.content.intro.trim() || form.content.phases.length || form.content.options.length;
    if (hasContent && !window.confirm(t("confirmTemplate"))) return;
    const next = proposalTemplate(template, form.locale);
    setForm((f) => ({ ...f, title: next.title || f.title, content: next.content }));
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
      clientPhone: contact.phone ?? "",
    }));
  }

  function pickDeal(id: string) {
    const deal = deals.find((d) => d.id === id);
    if (!deal) {
      update("dealId", null);
      return;
    }
    if (!form.contactId || form.contactId !== deal.contactId) pickContact(deal.contactId);
    setForm((f) => ({ ...f, dealId: deal.id, currency: deal.currency || f.currency }));
  }

  const dealChoices = form.contactId ? deals.filter((d) => d.contactId === form.contactId) : deals;

  // ---- Field helpers ------------------------------------------------------
  const listField = (key: ListKey) => (
    <Field key={key} label={t(`sections.${key}`)} hint={t("onePerLine")}>
      <textarea
        rows={Math.max(3, form.content[key].length + 1)}
        value={form.content[key].join("\n")}
        onChange={(e) => updateContent(key, e.target.value.split("\n"))}
        disabled={!editable}
        className={textareaClass}
        dir="auto"
      />
    </Field>
  );
  const textField = (key: TextKey, rows = 4) => (
    <Field key={key} label={t(`sections.${key}`)}>
      <textarea rows={rows} value={form.content[key]} onChange={(e) => updateContent(key, e.target.value)} disabled={!editable} className={textareaClass} dir="auto" />
    </Field>
  );

  const setPhase = (i: number, patch: Partial<ProposalPhase>) =>
    updateContent("phases", form.content.phases.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const movePhase = (i: number, dir: -1 | 1) => {
    const next = [...form.content.phases];
    const [item] = next.splice(i, 1);
    next.splice(i + dir, 0, item);
    updateContent("phases", next);
  };
  const setOption = (i: number, patch: Partial<ProposalOption>) =>
    updateContent(
      "options",
      form.content.options.map((o, j) => (j === i ? { ...o, ...patch } : patch.recommended ? { ...o, recommended: false } : o)),
    );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        {/* Action bar */}
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-canvas/95 px-1 py-2 backdrop-blur">
          {canEdit ? (
            <>
              <button type="button" onClick={handleSave} disabled={!editable || busy !== null} className={secondaryButton}>
                {busy === "save" ? <Spinner /> : null}
                {busy === "save" ? tc("saving") : tc("save")}
              </button>
              <button type="button" onClick={() => handleSend(false)} disabled={!editable || busy !== null} className={primaryButton}>
                {busy === "send" ? <Spinner /> : null}
                {busy === "send" ? tc("sending") : tc("sendEmail")}
              </button>
              <button type="button" onClick={() => handleSend(true)} disabled={!editable || busy !== null} className={secondaryButton}>
                {busy === "manual" ? <Spinner /> : null}
                {tc("sendManual")}
              </button>
            </>
          ) : null}
          <button type="button" onClick={handleDownload} disabled={busy !== null} className={secondaryButton}>
            {busy === "pdf" ? <Spinner /> : null}
            {busy === "pdf" ? tc("preparingPdf") : tc("downloadPdf")}
          </button>
          {dirty && editable ? <span className="text-xs font-semibold text-amber-deep">● {tc("unsaved")}</span> : null}
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

        {saved ? <ProposalPanel proposal={saved} comments={comments} canEdit={canEdit} /> : null}

        <section className={cardClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tc("docLanguage")}>
              <select value={form.locale} onChange={(e) => update("locale", e.target.value as DocLocale)} disabled={!editable} className={inputClass}>
                <option value="en">{tc("langEn")}</option>
                <option value="fa">{tc("langFa")}</option>
              </select>
            </Field>
            <Field label={t("template")}>
              <div className="flex gap-2">
                <select value={template} onChange={(e) => setTemplate(e.target.value as ProposalTemplateKey)} disabled={!editable} className={inputClass}>
                  {PROPOSAL_TEMPLATE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {t(`templates.${key}`)}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={applyTemplate} disabled={!editable} className={`${secondaryButton} shrink-0`}>
                  {t("applyTemplate")}
                </button>
              </div>
            </Field>
            <Field label={tc("title")} className="sm:col-span-2">
              <input value={form.title} onChange={(e) => update("title", e.target.value)} disabled={!editable} className={inputClass} dir="auto" />
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
            <Field label={t("validUntil")}>
              <input type="date" value={form.validUntil} onChange={(e) => update("validUntil", e.target.value)} disabled={!editable} className={inputClass} />
            </Field>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="font-display text-lg font-bold text-ink">{tc("client")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={tc("pickContact")}>
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
            <Field label={tc("clientPhone")}>
              <input value={form.clientPhone} onChange={(e) => update("clientPhone", e.target.value)} disabled={!editable} className={inputClass} dir="ltr" />
            </Field>
          </div>
        </section>

        <section className={`${cardClass} flex flex-col gap-5`}>
          {textField("intro", 6)}
          {listField("understanding")}
          {listField("goals")}

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-ink/60">{t("sections.phases")}</span>
            {form.content.phases.map((phase, i) => (
              <div key={i} className="rounded-2xl border-2 border-ink/10 bg-mist/20 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                  <input placeholder={t("phaseTitle")} value={phase.title} onChange={(e) => setPhase(i, { title: e.target.value })} disabled={!editable} className={inputClass} dir="auto" />
                  <input placeholder={t("phaseDuration")} value={phase.duration} onChange={(e) => setPhase(i, { duration: e.target.value })} disabled={!editable} className={inputClass} dir="auto" />
                </div>
                <textarea
                  rows={2}
                  placeholder={t("phaseDetail")}
                  value={phase.detail}
                  onChange={(e) => setPhase(i, { detail: e.target.value })}
                  disabled={!editable}
                  className={`${textareaClass} mt-3`}
                  dir="auto"
                />
                {editable ? (
                  <div className="mt-2 flex gap-3 text-xs font-semibold">
                    <button type="button" disabled={i === 0} onClick={() => movePhase(i, -1)} className="text-ink/60 hover:text-ink disabled:opacity-30">
                      {t("moveUp")}
                    </button>
                    <button type="button" disabled={i === form.content.phases.length - 1} onClick={() => movePhase(i, 1)} className="text-ink/60 hover:text-ink disabled:opacity-30">
                      {t("moveDown")}
                    </button>
                    <button type="button" onClick={() => updateContent("phases", form.content.phases.filter((_, j) => j !== i))} className="ms-auto text-amber-deep hover:underline">
                      {t("remove")}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {editable ? (
              <button
                type="button"
                onClick={() => updateContent("phases", [...form.content.phases, { title: "", detail: "", duration: "" }])}
                className="self-start text-sm font-semibold text-cobalt hover:underline"
              >
                {t("addPhase")}
              </button>
            ) : null}
          </div>

          {listField("deliverables")}
          {textField("methodology")}
          {textField("timelineNote", 2)}

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-ink/60">{t("sections.options")}</span>
            {form.content.options.map((option, i) => (
              <div key={option.id} className={`rounded-2xl border-2 p-4 ${option.recommended ? "border-cobalt/50 bg-cobalt/5" : "border-ink/10 bg-mist/20"}`}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("optionName")}>
                    <input value={option.name} onChange={(e) => setOption(i, { name: e.target.value })} disabled={!editable} className={inputClass} dir="auto" />
                  </Field>
                  <Field label={`${t("optionPrice")} (${form.currency})`}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={option.priceCents / 100}
                      onChange={(e) => setOption(i, { priceCents: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })}
                      disabled={!editable}
                      className={inputClass}
                      dir="ltr"
                    />
                  </Field>
                  <Field label={t("optionTagline")} className="sm:col-span-2">
                    <input value={option.tagline} onChange={(e) => setOption(i, { tagline: e.target.value })} disabled={!editable} className={inputClass} dir="auto" />
                  </Field>
                  <Field label={t("optionFeatures")} className="sm:col-span-2">
                    <textarea
                      rows={Math.max(3, option.features.length + 1)}
                      value={option.features.join("\n")}
                      onChange={(e) => setOption(i, { features: e.target.value.split("\n") })}
                      disabled={!editable}
                      className={textareaClass}
                      dir="auto"
                    />
                  </Field>
                  <Field label={t("optionDuration")}>
                    <input value={option.durationNote} onChange={(e) => setOption(i, { durationNote: e.target.value })} disabled={!editable} className={inputClass} dir="auto" />
                  </Field>
                  <Field label={t("optionPayment")}>
                    <input value={option.paymentNote} onChange={(e) => setOption(i, { paymentNote: e.target.value })} disabled={!editable} className={inputClass} dir="auto" />
                  </Field>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <label className="inline-flex items-center gap-2 font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={option.recommended}
                      onChange={(e) => setOption(i, { recommended: e.target.checked })}
                      disabled={!editable}
                      className="h-4 w-4 accent-cobalt"
                    />
                    {t("optionRecommended")}
                  </label>
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => updateContent("options", form.content.options.filter((_, j) => j !== i))}
                      className="ms-auto text-xs font-semibold text-amber-deep hover:underline"
                    >
                      {t("remove")}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {editable && form.content.options.length < 4 ? (
              <button
                type="button"
                onClick={() =>
                  updateContent("options", [
                    ...form.content.options,
                    {
                      id: `opt-${Date.now().toString(36)}`,
                      name: "",
                      tagline: "",
                      priceCents: 0,
                      recommended: form.content.options.length === 0,
                      features: [],
                      paymentNote: "",
                      durationNote: "",
                    },
                  ])
                }
                className="self-start text-sm font-semibold text-cobalt hover:underline"
              >
                {t("addOption")}
              </button>
            ) : null}
          </div>

          {listField("exclusions")}
          {listField("assumptions")}
          {listField("whyMe")}
          {listField("nextSteps")}
          {textField("termsNote", 3)}
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
