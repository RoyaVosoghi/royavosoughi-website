"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { Proposal, ProposalComment } from "@/lib/admin/crm-docs";

import { Notice, Spinner, StatusChip, cardClass, dangerButton, formatWhen, primaryButton, secondaryButton, textareaClass } from "./ui";

export function ProposalPanel({ proposal, comments, canEdit }: { proposal: Proposal; comments: ProposalComment[]; canEdit: boolean }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("proposals.panel");
  const tc = useTranslations("crmDocs");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<null | "reply" | "status" | "delete" | "convert">(null);
  const [note, setNote] = useState<{ tone: "success" | "warn"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const option = proposal.content.options.find((o) => o.id === proposal.selectedOption);
  const clientUrl = typeof window !== "undefined" ? `${window.location.origin}/proposal/${proposal.viewToken}` : "";
  const canConvert = !["draft", "converted", "canceled", "declined"].includes(proposal.status);

  async function post(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: response.ok, data: await response.json().catch(() => ({})) };
  }

  async function sendReply() {
    setBusy("reply");
    const { ok, data } = await post(`/api/admin/proposals/${proposal.id}/comments`, { body: reply });
    setBusy(null);
    if (!ok) {
      setNote({ tone: "warn", text: tc("errors.generic") });
      return;
    }
    setReply("");
    setNote({ tone: "success", text: data.emailed ? t("replySent") : t("replySavedOnly") });
    router.refresh();
  }

  async function changeStatus(action: "cancel" | "reopen") {
    if (action === "cancel" && !window.confirm(tc("confirmCancel"))) return;
    setBusy("status");
    const { ok } = await post(`/api/admin/proposals/${proposal.id}/status`, { action });
    setBusy(null);
    if (!ok) setNote({ tone: "warn", text: tc("errors.generic") });
    // The editor holds its own copy of the proposal — a full reload re-reads status everywhere.
    else window.location.reload();
  }

  async function remove() {
    if (!window.confirm(tc("confirmDelete"))) return;
    setBusy("delete");
    const response = await fetch(`/api/admin/proposals/${proposal.id}`, { method: "DELETE" });
    setBusy(null);
    if (!response.ok) {
      setNote({ tone: "warn", text: tc("errors.generic") });
      return;
    }
    router.push("/admin/proposals");
    router.refresh();
  }

  async function convert() {
    setBusy("convert");
    const { ok, data } = await post(`/api/admin/proposals/${proposal.id}/convert`);
    setBusy(null);
    if (!ok) {
      setNote({ tone: "warn", text: tc("errors.generic") });
      return;
    }
    router.push(`/admin/contracts/${data.contractId}`);
  }

  async function copyLink() {
    await navigator.clipboard?.writeText(clientUrl).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-bold text-ink">{t("title")}</h2>
        <StatusChip status={proposal.status} label={tc(`status.${proposal.status}`)} />
        <span dir="ltr" className="font-mono text-xs text-ink/50">
          {proposal.proposalNo}
        </span>
        {proposal.revision > 0 ? <span className="text-xs text-ink/50">{t("revision", { n: proposal.revision })}</span> : null}
      </div>

      <ul className="mt-3 flex flex-col gap-1 text-sm text-ink/75">
        {proposal.sentAt ? <li>{t("sentAt", { when: formatWhen(proposal.sentAt, locale) })}</li> : null}
        {proposal.status !== "draft" ? (
          <li>
            {t("views", { count: proposal.viewCount })}
            {proposal.lastViewedAt ? ` · ${t("lastViewed", { when: formatWhen(proposal.lastViewedAt, locale) })}` : ""}
          </li>
        ) : null}
        {proposal.respondedAt && proposal.responderName ? (
          <li>
            {t("respondedBy", { name: proposal.responderName, when: formatWhen(proposal.respondedAt, locale) })}
            {proposal.responderIp ? (
              <span className="ms-2 text-xs text-ink/45" dir="ltr">
                {t("fromIp", { ip: proposal.responderIp })}
              </span>
            ) : null}
          </li>
        ) : null}
        {option ? <li className="font-semibold text-cobalt">{t("selectedOption", { name: option.name })}</li> : null}
        {proposal.status === "changes_requested" ? <li className="text-xs text-ink/55">{t("resendHint")}</li> : null}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        {proposal.status !== "draft" ? (
          <button type="button" onClick={copyLink} className={secondaryButton}>
            {copied ? tc("linkCopied") : tc("copyLink")}
          </button>
        ) : null}
        {canEdit && proposal.contractId ? (
          <Link href={`/admin/contracts/${proposal.contractId}`} className={primaryButton}>
            {t("openContract")}
          </Link>
        ) : null}
        {canEdit && canConvert ? (
          <button type="button" onClick={convert} disabled={busy !== null} className={primaryButton}>
            {busy === "convert" ? <Spinner /> : null}
            {busy === "convert" ? t("converting") : t("convert")}
          </button>
        ) : null}
        {canEdit && proposal.status !== "converted" ? (
          proposal.status === "canceled" ? (
            <button type="button" onClick={() => changeStatus("reopen")} disabled={busy !== null} className={secondaryButton}>
              {tc("reopenDoc")}
            </button>
          ) : (
            <button type="button" onClick={() => changeStatus("cancel")} disabled={busy !== null} className={secondaryButton}>
              {tc("cancelDoc")}
            </button>
          )
        ) : null}
        {canEdit ? (
          <button type="button" onClick={remove} disabled={busy !== null} className={dangerButton}>
            {tc("deleteDoc")}
          </button>
        ) : null}
      </div>

      {note ? (
        <div className="mt-4">
          <Notice tone={note.tone}>{note.text}</Notice>
        </div>
      ) : null}

      {proposal.status !== "draft" ? (
        <div className="mt-6 border-t-2 border-ink/5 pt-5">
          <h3 className="font-display text-base font-bold text-ink">{t("thread")}</h3>
          {comments.length === 0 ? (
            <p className="mt-2 text-sm text-ink/50">{t("threadEmpty")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    c.author === "client" ? "self-start bg-mist/60 text-ink" : "self-end bg-cobalt/10 text-ink"
                  }`}
                >
                  <p className="text-xs font-semibold text-ink/55">
                    {c.author === "client" ? t("fromClient") : t("fromYou")} · {formatWhen(c.createdAt, locale)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap" dir="auto">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canEdit ? (
            <div className="mt-3 flex flex-col gap-2">
              <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("replyPlaceholder")} className={textareaClass} dir="auto" />
              <button type="button" onClick={sendReply} disabled={!reply.trim() || busy !== null} className={`${secondaryButton} self-end`}>
                {busy === "reply" ? <Spinner /> : null}
                {t("replyButton")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
