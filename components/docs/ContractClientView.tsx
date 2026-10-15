"use client";

import { useMemo, useRef, useState } from "react";

import { contractToBlocks, type ContractStatus } from "@/lib/crm/contract";
import { docLabels } from "@/lib/crm/doc-labels";
import { formatDateTimeUtc, type DocLocale } from "@/lib/crm/format";
import { publicLabels } from "@/lib/crm/public-labels";

import { A4Document, downloadBlob, type A4DocumentHandle } from "./A4Document";
import { PublicHeader } from "./PublicHeader";

export interface PublicContract {
  locale: DocLocale;
  title: string;
  contractNo: string;
  clientName: string;
  clientCompany: string | null;
  bodyMd: string;
  issuedAt: string;
  status: ContractStatus;
  acceptedByName: string | null;
  acceptedAt: string | null;
  acceptedIp: string | null;
  copySent: boolean;
}

interface Acceptance {
  name: string;
  at: string;
  ip: string | null;
}

export function ContractClientView({ token, contract }: { token: string; contract: PublicContract }) {
  const { locale } = contract;
  const P = publicLabels(locale);
  const L = docLabels(locale);
  const docRef = useRef<A4DocumentHandle>(null);

  const [acceptance, setAcceptance] = useState<Acceptance | null>(
    contract.status === "accepted" && contract.acceptedByName && contract.acceptedAt
      ? { name: contract.acceptedByName, at: contract.acceptedAt, ip: contract.acceptedIp }
      : null,
  );
  const [emailed, setEmailed] = useState(contract.copySent);
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState<null | "accepting" | "finishing" | "pdf">(null);
  const [error, setError] = useState<string | null>(null);

  const blocks = useMemo(
    () =>
      contractToBlocks({
        locale,
        title: contract.title,
        contractNo: contract.contractNo,
        clientName: contract.clientName,
        clientCompany: contract.clientCompany,
        bodyMd: contract.bodyMd,
        issuedAt: contract.issuedAt,
        acceptedByName: acceptance?.name ?? null,
        acceptedAt: acceptance?.at ?? null,
        acceptedIp: acceptance?.ip ?? null,
      }),
    [contract, locale, acceptance],
  );
  const meta = useMemo(() => ({ locale, kindLabel: L.contract, docNo: contract.contractNo }), [locale, L, contract.contractNo]);

  async function download() {
    setPhase("pdf");
    try {
      const { blob } = await docRef.current!.exportPdf();
      downloadBlob(blob, `${contract.contractNo}${acceptance ? "-signed" : ""}.pdf`);
    } finally {
      setPhase(null);
    }
  }

  /**
   * Phase 1: the server stamps name + time + IP and returns them.
   * Phase 2: the signature box is re-rendered with exactly those values,
   * the signed PDF is built here, and the server emails it (once).
   */
  async function accept() {
    setPhase("accepting");
    setError(null);
    let accepted = false;
    try {
      const response = await fetch(`/api/contract/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), agreed: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = data.error as keyof typeof P.contract.errors;
        setError(P.contract.errors[code] ?? P.contract.errors.generic);
        return;
      }

      accepted = true;
      setPhase("finishing");
      setAcceptance({ name: data.acceptedByName, at: data.acceptedAt, ip: data.acceptedIp });
      await docRef.current!.relayout();
      const { base64 } = await docRef.current!.exportPdf();
      const copy = await fetch(`/api/contract/${token}/accepted-copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64 }),
      });
      const copyData = await copy.json().catch(() => ({}));
      setEmailed(Boolean(copy.ok && (copyData.emailed || copyData.alreadySent)));
    } catch (err) {
      console.error(err);
      // After phase 1 the acceptance is already recorded — a failed copy email isn't the client's problem.
      if (!accepted) setError(P.contract.errors.generic);
    } finally {
      setPhase(null);
    }
  }

  const canAccept = (contract.status === "sent" || contract.status === "viewed") && !acceptance;

  return (
    <div dir={locale === "fa" ? "rtl" : "ltr"} lang={locale} className={`locale-${locale} min-h-dvh`}>
      <PublicHeader label={L.contract} docNo={contract.contractNo} onDownload={download} downloading={phase === "pdf"} labels={P} />

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <A4Document ref={docRef} blocks={blocks} meta={meta} variant="public" labels={P.viewer} />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          {acceptance ? (
            <div className="rounded-3xl border-2 border-cobalt/30 bg-white p-5">
              <h2 className="font-display text-lg font-bold text-cobalt">✓ {P.contract.accepted}</h2>
              <p className="mt-2 text-sm text-ink/80">
                {(emailed ? P.contract.acceptedBody : P.contract.acceptedNoEmail)(acceptance.name, formatDateTimeUtc(acceptance.at, locale))}
              </p>
              {phase === "finishing" ? <p className="mt-2 text-xs text-ink/55">{P.contract.finishing}</p> : null}
              <button
                type="button"
                onClick={download}
                disabled={phase !== null}
                className="mt-4 w-full rounded-full bg-cobalt px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-cobalt-dark disabled:opacity-50"
              >
                {phase === "pdf" ? P.preparing : P.download}
              </button>
            </div>
          ) : canAccept ? (
            <div className="rounded-3xl border-2 border-ink/10 bg-white p-5">
              <h2 className="font-display text-lg font-bold text-ink">{P.contract.acceptTitle}</h2>
              <p className="mt-1 text-sm text-ink/70">{P.contract.acceptIntro}</p>
              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink/60">{P.contract.yourName}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-2.5 text-sm text-ink focus:border-cobalt focus:outline-none"
                  dir="auto"
                  autoComplete="name"
                />
              </label>
              <label className="mt-4 flex items-start gap-3 text-sm text-ink">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-cobalt" />
                <span>{P.contract.agree}</span>
              </label>
              {error ? <p className="mt-3 text-sm font-medium text-amber-deep">{error}</p> : null}
              <button
                type="button"
                onClick={accept}
                disabled={phase !== null || !agreed || name.trim().length < 2}
                className="mt-4 w-full rounded-full bg-cobalt px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-cobalt-dark disabled:opacity-50"
              >
                {phase === "accepting" ? P.contract.accepting : P.contract.accept}
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-ink/10 bg-white p-5 text-sm font-semibold text-ink">{P.contract.canceled}</div>
          )}
        </aside>
      </main>
    </div>
  );
}
