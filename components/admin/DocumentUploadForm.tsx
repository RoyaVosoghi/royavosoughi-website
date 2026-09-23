"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Kind = "pdf" | "docx" | "text" | "url";

export function DocumentUploadForm() {
  const t = useTranslations("knowledge");
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("text");
  const [sourceKey, setSourceKey] = useState("");
  const [locale, setLocale] = useState<"en" | "fa">("en");
  const [tags, setTags] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const KIND_LABELS: Record<Kind, string> = {
    pdf: t("upload.kindPdf"),
    docx: t("upload.kindDocx"),
    text: t("upload.kindText"),
    url: t("upload.kindUrl"),
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);

    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("sourceKey", sourceKey);
    formData.set("locale", locale);
    formData.set("tags", tags);
    if (kind === "text") formData.set("text", text);
    if (kind === "url") formData.set("url", url);
    if ((kind === "pdf" || kind === "docx") && file) formData.set("file", file);

    const response = await fetch("/api/admin/documents", { method: "POST", body: formData });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.message || t("upload.errorGeneric"));
      setStatus("error");
      return;
    }

    setSourceKey("");
    setTags("");
    setText("");
    setUrl("");
    setFile(null);
    setStatus("idle");
    router.refresh();
  }

  const canSubmit =
    sourceKey.trim().length > 0 &&
    ((kind === "text" && text.trim().length > 0) ||
      (kind === "url" && url.trim().length > 0) ||
      ((kind === "pdf" || kind === "docx") && file !== null));

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border-2 border-soft/10 bg-indigo p-6">
      <h2 className="font-display text-lg font-bold text-soft">{t("upload.heading")}</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              kind === k ? "bg-cyan text-indigo" : "bg-soft/5 text-soft/60 hover:bg-soft/10"
            }`}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-soft/70">
          {t("upload.sourceKeyLabel")}
          <input
            type="text"
            value={sourceKey}
            onChange={(e) => setSourceKey(e.target.value)}
            placeholder={t("upload.sourceKeyPlaceholder")}
            className="mt-1 w-full rounded-xl border-2 border-soft/15 bg-indigo px-3 py-2 text-sm text-soft focus:border-cyan focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-soft/70">
          {t("upload.localeLabel")}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as "en" | "fa")}
            className="mt-1 w-full rounded-xl border-2 border-soft/15 bg-indigo px-3 py-2 text-sm text-soft focus:border-cyan focus:outline-none"
          >
            <option value="en">{t("localeEnglish")}</option>
            <option value="fa">{t("localeFa")}</option>
          </select>
        </label>
        <label className="text-xs font-medium text-soft/70">
          {t("upload.tagsLabel")}
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t("upload.tagsPlaceholder")}
            className="mt-1 w-full rounded-xl border-2 border-soft/15 bg-indigo px-3 py-2 text-sm text-soft focus:border-cyan focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-3">
        {kind === "text" ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={t("upload.textPlaceholder")}
            className="w-full rounded-xl border-2 border-soft/15 bg-indigo px-3 py-2 text-sm text-soft focus:border-cyan focus:outline-none"
          />
        ) : null}
        {kind === "url" ? (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("upload.urlPlaceholder")}
            className="w-full rounded-xl border-2 border-soft/15 bg-indigo px-3 py-2 text-sm text-soft focus:border-cyan focus:outline-none"
          />
        ) : null}
        {kind === "pdf" || kind === "docx" ? (
          <input
            type="file"
            accept={kind === "pdf" ? ".pdf" : ".docx"}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-soft/70"
          />
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-amber-soft">{error}</p> : null}

      <button
        type="submit"
        disabled={status === "submitting" || !canSubmit}
        className="mt-4 rounded-full bg-cyan px-6 py-2.5 text-sm font-semibold text-indigo transition-colors hover:bg-soft disabled:opacity-50"
      >
        {status === "submitting" ? t("upload.submitting") : t("upload.submit")}
      </button>
    </form>
  );
}
