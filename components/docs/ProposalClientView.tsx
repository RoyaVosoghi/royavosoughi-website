"use client";

import { useMemo, useRef, useState } from "react";

import { docLabels } from "@/lib/crm/doc-labels";
import { formatDateTimeUtc, formatMoney, type DocLocale } from "@/lib/crm/format";
import { PROPOSAL_OPEN_FOR_RESPONSE, proposalToBlocks, type ProposalContent, type ProposalStatus } from "@/lib/crm/proposal";
import { publicLabels } from "@/lib/crm/public-labels";

import { A4Document, downloadBlob, type A4DocumentHandle } from "./A4Document";
import { PublicHeader } from "./PublicHeader";

export interface PublicProposal {
  locale: DocLocale;
  title: string;
  proposalNo: string;
  revision: number;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string;
  currency: string;
  validUntil: string | null;
  issuedAt: string;
  status: ProposalStatus;
  selectedOption: string | null;
  responderName: string | null;
  respondedAt: string | null;
  content: ProposalContent;
}

type Mode = "idle" | "changes" | "decline";

const input =
  "w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-2.5 text-sm text-ink focus:border-cobalt focus:outline-none";

export function ProposalClientView({
  token,
  proposal,
  comments,
}: {
  token: string;
  proposal: PublicProposal;
  comments: Array<{ id: string; author: "client" | "admin"; body: string; createdAt: string }>;
}) {
  const { locale } = proposal;
  const P = publicLabels(locale);
  const L = docLabels(locale);
  const docRef = useRef<A4DocumentHandle>(null);

  const [status, setStatus] = useState<ProposalStatus>(proposal.status);
  const [selected, setSelected] = useState<string | null>(
    proposal.selectedOption ?? proposal.content.options.find((o) => o.recommended)?.id ?? proposal.content.options[0]?.id ?? null,
  );
  const [name, setName] = useState(proposal.clientName);
  const [comment, setComment] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState<null | "submit" | "pdf">(null);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<keyof typeof P.proposal.thanks | null>(null);

  const open = PROPOSAL_OPEN_FOR_RESPONSE.includes(status) && !thanks;
  const shownOption = open ? null : (proposal.selectedOption ?? (thanks === "approved" ? selected : null));

  const blocks = useMemo(
    () =>
      proposalToBlocks({
        locale,
        title: proposal.title,
        proposalNo: proposal.proposalNo,
        revision: proposal.revision,
        clientName: proposal.clientName,
        clientCompany: proposal.clientCompany,
        clientEmail: proposal.clientEmail,
        currency: proposal.currency,
        validUntil: proposal.validUntil,
        issuedAt: proposal.issuedAt,
        selectedOption: shownOption,
        content: proposal.content,
      }),
    [proposal, locale, shownOption],
  );
  const meta = useMemo(() => ({ locale, kindLabel: L.proposal, docNo: proposal.proposalNo }), [locale, L, proposal.proposalNo]);

  async function download() {
    setBusy("pdf");
    try {
      const { blob } = await docRef.current!.exportPdf();
      downloadBlob(blob, `${proposal.proposalNo}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  async function submit(action: "approved" | "changes_requested" | "declined") {
    setBusy("submit");
    setError(null);
    const response = await fetch(`/api/proposal/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "approved"
          ? { action, name, optionId: selected, comment: comment || undefined }
          : { action, name, comment: comment || undefined },
      ),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      const code = data.error as keyof typeof P.proposal.errors;
      setError(P.proposal.errors[code] ?? P.proposal.errors.generic);
      return;
    }
    setStatus(action);
    setThanks(action);
  }

  const alreadyKey = status as keyof typeof P.proposal.already;
  const nameOk = name.trim().length >= 2;

  return (
    <div dir={locale === "fa" ? "rtl" : "ltr"} lang={locale} className={`locale-${locale} min-h-dvh`}>
      <PublicHeader label={L.proposal} docNo={proposal.proposalNo} onDownload={download} downloading={busy === "pdf"} labels={P} />

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <A4Document ref={docRef} blocks={blocks} meta={meta} variant="public" labels={P.viewer} />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          {thanks ? (
            <div className="rounded-3xl border-2 border-cobalt/30 bg-white p-5 text-sm text-ink">{P.proposal.thanks[thanks]}</div>
          ) : open ? (
            <div className="rounded-3xl border-2 border-ink/10 bg-white p-5">
              <h2 className="font-display text-lg font-bold text-ink">{P.proposal.respondTitle}</h2>
              <p className="mt-1 text-sm text-ink/70">{P.proposal.respondIntro}</p>

              {proposal.content.options.length && mode === "idle" ? (
                <fieldset className="mt-4 flex flex-col gap-2">
                  <legend className="mb-2 text-xs font-semibold text-ink/60">{P.proposal.choosePackage}</legend>
                  {proposal.content.options.map((o) => (
                    <label
                      key={o.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-3 transition-colors ${
                        selected === o.id ? "border-cobalt bg-cobalt/5" : "border-ink/10 hover:border-ink/25"
                      }`}
                    >
                      <input type="radio" name="option" value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} className="mt-1 accent-cobalt" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-ink">{o.name}</span>
                          <span className="whitespace-nowrap text-sm font-bold text-cobalt">{formatMoney(o.priceCents, proposal.currency, locale)}</span>
                        </span>
                        {o.recommended ? <span className="text-xs font-semibold text-cobalt">{L.recommended}</span> : null}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null}

              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink/60">{P.proposal.yourName}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={input} dir="auto" autoComplete="name" />
              </label>

              {mode !== "idle" ? (
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={mode === "changes" ? P.proposal.changesPlaceholder : P.proposal.declinePlaceholder}
                  className={`${input} mt-3`}
                  dir="auto"
                />
              ) : null}

              {error ? <p className="mt-3 text-sm font-medium text-amber-deep">{error}</p> : null}

              <div className="mt-4 flex flex-col gap-2">
                {mode === "idle" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => submit("approved")}
                      disabled={busy !== null || !nameOk || (proposal.content.options.length > 0 && !selected)}
                      className="rounded-full bg-cobalt px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-cobalt-dark disabled:opacity-50"
                    >
                      {busy === "submit" ? P.proposal.submitting : P.proposal.approve}
                    </button>
                    <button type="button" onClick={() => setMode("changes")} className="rounded-full border-2 border-ink/20 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-mist/50">
                      {P.proposal.requestChanges}
                    </button>
                    <button type="button" onClick={() => setMode("decline")} className="px-5 py-1.5 text-sm font-medium text-ink/55 hover:text-ink">
                      {P.proposal.decline}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => submit(mode === "changes" ? "changes_requested" : "declined")}
                      disabled={busy !== null || !nameOk || (mode === "changes" && comment.trim().length < 3)}
                      className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-colors hover:bg-ink-soft disabled:opacity-50"
                    >
                      {busy === "submit" ? P.proposal.submitting : mode === "changes" ? P.proposal.sendChanges : P.proposal.confirmDecline}
                    </button>
                    <button type="button" onClick={() => setMode("idle")} className="px-5 py-1.5 text-sm font-medium text-ink/55 hover:text-ink">
                      {P.proposal.back}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-ink/10 bg-white p-5 text-sm text-ink">
              <p className="font-semibold">{P.proposal.already[alreadyKey] ?? P.proposal.already.canceled}</p>
              {proposal.responderName && proposal.respondedAt && status !== "canceled" ? (
                <p className="mt-1 text-ink/70">{P.proposal.by(proposal.responderName, formatDateTimeUtc(proposal.respondedAt, locale))}</p>
              ) : null}
            </div>
          )}

          {comments.length ? (
            <div className="rounded-3xl border-2 border-ink/10 bg-white p-5">
              <h3 className="font-display text-base font-bold text-ink">{P.proposal.conversation}</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {comments.map((c) => (
                  <li key={c.id} className={`rounded-2xl px-3.5 py-2.5 text-sm ${c.author === "client" ? "bg-mist/60" : "bg-cobalt/10"}`}>
                    <p className="text-xs font-semibold text-ink/55">
                      {c.author === "client" ? P.proposal.fromClient : P.proposal.fromRoya} · {formatDateTimeUtc(c.createdAt, locale)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-ink" dir="auto">
                      {c.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
