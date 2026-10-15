"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Markdown } from "@/components/blog/Markdown";
import { Field, Notice, Spinner, cardClass, dangerButton, inputClass, primaryButton, secondaryButton, textareaClass } from "@/components/admin/crm/ui";
import type { BlogPost, BlogStatus } from "@/lib/blog";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

interface Form {
  locale: "en" | "fa";
  slug: string;
  title: string;
  excerpt: string;
  tags: string;
  bodyMd: string;
}

export function BlogEditor({ post, canEdit }: { post: BlogPost | null; canEdit: boolean }) {
  const router = useRouter();
  const t = useTranslations("blogAdmin");
  const [saved, setSaved] = useState<BlogPost | null>(post);
  const [form, setForm] = useState<Form>({
    locale: post?.locale ?? "en",
    slug: post?.slug ?? "",
    title: post?.title ?? "",
    excerpt: post?.excerpt ?? "",
    tags: post?.tags.join(", ") ?? "",
    bodyMd: post?.bodyMd ?? "",
  });
  // Auto-derive the slug from an English title until the admin types one themselves.
  const slugTouched = useRef(Boolean(post));
  const [busy, setBusy] = useState<null | "save" | "delete">(null);
  const [message, setMessage] = useState<{ tone: "success" | "warn"; text: string } | null>(null);
  const deferredBody = useDeferredValue(form.bodyMd);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save(status: BlogStatus) {
    setBusy("save");
    setMessage(null);
    const payload = {
      locale: form.locale,
      slug: form.slug.trim(),
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      bodyMd: form.bodyMd,
      tags: form.tags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
      status,
    };
    const response = await fetch(saved ? `/api/admin/blog/${saved.id}` : "/api/admin/blog", {
      method: saved ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setMessage({ tone: "warn", text: data.error === "slug_taken" ? t("errorSlug") : t("errorGeneric") });
      return;
    }
    setSaved(data.post);
    setMessage({ tone: "success", text: t("saved") });
    if (!saved) router.replace(`/admin/blog/${data.post.id}`);
    else router.refresh();
  }

  async function remove() {
    if (!saved || !window.confirm(t("confirmDelete"))) return;
    setBusy("delete");
    const response = await fetch(`/api/admin/blog/${saved.id}`, { method: "DELETE" });
    setBusy(null);
    if (response.ok) {
      router.push("/admin/blog");
      router.refresh();
    } else setMessage({ tone: "warn", text: t("errorGeneric") });
  }

  const published = saved?.status === "published";
  const valid = form.title.trim() && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug.trim());
  const dir = form.locale === "fa" ? "rtl" : "ltr";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        {canEdit ? (
          <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-canvas/95 px-1 py-2 backdrop-blur">
            {published ? (
              <>
                <button type="button" onClick={() => save("published")} disabled={!valid || busy !== null} className={primaryButton}>
                  {busy === "save" ? <Spinner /> : null}
                  {t("update")}
                </button>
                <button type="button" onClick={() => save("draft")} disabled={!valid || busy !== null} className={secondaryButton}>
                  {t("unpublish")}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => save("draft")} disabled={!valid || busy !== null} className={secondaryButton}>
                  {busy === "save" ? <Spinner /> : null}
                  {t("save")}
                </button>
                <button type="button" onClick={() => save("published")} disabled={!valid || busy !== null} className={primaryButton}>
                  {t("publish")}
                </button>
              </>
            )}
            {published && saved ? (
              <a href={`/${saved.locale}/blog/${saved.slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-cobalt hover:underline">
                {t("viewLive")}
              </a>
            ) : null}
            {saved ? (
              <button type="button" onClick={remove} disabled={busy !== null} className={`${dangerButton} ms-auto`}>
                {t("delete")}
              </button>
            ) : null}
          </div>
        ) : null}

        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        <section className={`${cardClass} grid gap-4 sm:grid-cols-2`}>
          <Field label={t("language")}>
            <select value={form.locale} onChange={(e) => update("locale", e.target.value as "en" | "fa")} disabled={!canEdit} className={inputClass}>
              <option value="en">English</option>
              <option value="fa">فارسی</option>
            </select>
          </Field>
          <Field label={t("slug")} hint={t("slugHint")}>
            <input
              value={form.slug}
              onChange={(e) => {
                slugTouched.current = true;
                update("slug", e.target.value.toLowerCase());
              }}
              disabled={!canEdit}
              className={inputClass}
              dir="ltr"
            />
          </Field>
          <Field label={t("postTitle")} className="sm:col-span-2">
            <input
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((f) => ({ ...f, title, slug: slugTouched.current || f.locale === "fa" ? f.slug : slugify(title) }));
              }}
              disabled={!canEdit}
              className={inputClass}
              dir={dir}
            />
          </Field>
          <Field label={t("excerpt")} className="sm:col-span-2">
            <textarea rows={2} value={form.excerpt} onChange={(e) => update("excerpt", e.target.value)} disabled={!canEdit} className={textareaClass} dir={dir} />
          </Field>
          <Field label={t("tags")} className="sm:col-span-2">
            <input value={form.tags} onChange={(e) => update("tags", e.target.value)} disabled={!canEdit} className={inputClass} dir="ltr" />
          </Field>
        </section>

        <section className={cardClass}>
          <Field label={t("body")} hint={t("bodyHint")}>
            <textarea rows={26} value={form.bodyMd} onChange={(e) => update("bodyMd", e.target.value)} disabled={!canEdit} className={`${textareaClass} font-mono text-[13px]`} dir={dir} />
          </Field>
        </section>
      </div>

      <div className="min-w-0">
        <div className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border-2 border-ink/10 bg-canvas p-8" dir={dir} lang={form.locale}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink/50">{t("preview")}</p>
          <h1 className="text-3xl text-ink">{form.title || "—"}</h1>
          {form.excerpt ? <p className="mt-4 text-lg text-ink/70">{form.excerpt}</p> : null}
          <hr className="my-6 border-ink/10" />
          <Markdown source={deferredBody} className="text-base" />
        </div>
      </div>
    </div>
  );
}
