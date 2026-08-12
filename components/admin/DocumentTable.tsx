"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DocumentRow } from "@/lib/ai/documents";

function ActionsCell({ doc }: { doc: DocumentRow }) {
  const t = useTranslations("knowledge");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleStatus() {
    setBusy("status");
    const nextStatus = doc.status === "active" ? "archived" : "active";
    await fetch(`/api/admin/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setBusy(null);
    router.refresh();
  }

  async function reindex() {
    setBusy("reindex");
    const response = await fetch(`/api/admin/documents/${doc.id}/reindex`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (response.ok) {
      const failedSuffix = body.failed ? t("table.reindexFailedSuffix", { failed: body.failed }) : "";
      alert(t("table.reindexResult", { updated: body.updated, failedSuffix }));
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm(t("table.confirmDelete", { title: doc.title }))) return;
    setBusy("delete");
    await fetch(`/api/admin/documents/${doc.id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={toggleStatus} disabled={busy !== null} className="text-sm font-medium text-emerald hover:underline disabled:opacity-50">
        {doc.status === "active" ? t("table.actionArchive") : t("table.actionActivate")}
      </button>
      <button type="button" onClick={reindex} disabled={busy !== null} className="text-sm font-medium text-forest hover:underline disabled:opacity-50">
        {t("table.actionReindex")}
      </button>
      <button type="button" onClick={remove} disabled={busy !== null} className="text-sm font-medium text-saffron-deep hover:underline disabled:opacity-50">
        {t("table.actionDelete")}
      </button>
    </div>
  );
}

export function DocumentTable({ documents }: { documents: DocumentRow[] }) {
  const t = useTranslations("knowledge");

  if (documents.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-forest/20 bg-mint/40 p-10 text-center">
        <p className="font-display text-lg font-bold text-forest">{t("table.emptyTitle")}</p>
        <p className="mt-2 text-ink/70">{t("table.emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-3xl border-2 border-forest/10 bg-offwhite">
      <table className="w-full min-w-[800px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-forest/10 text-start">
            <th className="px-5 py-3 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("table.headerTitle")}</th>
            <th className="px-5 py-3 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("table.headerType")}</th>
            <th className="px-5 py-3 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("table.headerLocale")}</th>
            <th className="px-5 py-3 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("table.headerTags")}</th>
            <th className="px-5 py-3 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("table.headerChunks")}</th>
            <th className="px-5 py-3 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("table.headerStatus")}</th>
            <th className="px-5 py-3 font-display text-xs font-bold tracking-wide text-forest/70 uppercase">{t("table.headerActions")}</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-b border-forest/5 last:border-0 hover:bg-mint/30">
              <td className="px-5 py-3 text-ink/85">{doc.title}</td>
              <td className="px-5 py-3 text-ink/70 uppercase">{doc.sourceType}</td>
              <td className="px-5 py-3 text-ink/70 uppercase">{doc.locale}</td>
              <td className="px-5 py-3 text-ink/70">{doc.tags.join(", ") || "—"}</td>
              <td className="px-5 py-3 tabular-nums text-ink/70">{doc.chunkCount}</td>
              <td className="px-5 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    doc.status === "active" ? "bg-emerald/15 text-emerald" : "bg-forest/10 text-ink/50"
                  }`}
                >
                  {doc.status === "active" ? t("table.statusActive") : t("table.statusArchived")}
                </span>
              </td>
              <td className="px-5 py-3">
                <ActionsCell doc={doc} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
