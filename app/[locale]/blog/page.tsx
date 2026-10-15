import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Section } from "@/components/ui/Section";
import { formatPostDate, listPublishedPosts, readingMinutes, type BlogLocale } from "@/lib/blog";

/** Re-read published posts at most every 5 minutes; publishing from /admin/blog also revalidates immediately. */
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `/${locale}/blog`,
      languages: { en: "/en/blog", fa: "/fa/blog", "x-default": "/en/blog" },
    },
  };
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const posts = await listPublishedPosts(locale as BlogLocale);

  return (
    <Section tone="light" className="pt-14 md:pt-20">
      <div className="max-w-3xl">
        <p className="label-eyebrow text-cobalt">{t("eyebrow")}</p>
        <h1 className="text-section mt-4 text-ink">{t("title")}</h1>
        <p className="mt-6 text-xl text-ink/80">{t("intro")}</p>
      </div>

      {posts.length === 0 ? (
        /* Honest empty state — same rule as Projects: nothing appears before it's worth reading. */
        <div className="mt-14 rounded-3xl border-2 border-dashed border-ink/15 bg-mist/40 p-10 text-center">
          <p className="mx-auto max-w-md text-lg text-ink/75">{t("emptyState")}</p>
        </div>
      ) : (
        <ul className="mt-14 grid gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex h-full flex-col rounded-3xl border border-ink/10 bg-canvas p-8 transition-all duration-200 hover:-translate-y-1 hover:border-cobalt/40 hover:shadow-[0_12px_32px_-12px_rgba(30,30,30,0.25)]"
              >
                <p className="text-sm text-ink/60">
                  {formatPostDate(post.publishedAt, locale)} · {t("minutes", { count: readingMinutes(post.bodyMd) })}
                </p>
                <h2 className="mt-3 text-2xl text-ink group-hover:text-cobalt">{post.title}</h2>
                <p className="mt-3 flex-1 text-ink/75">{post.excerpt}</p>
                {post.tags.length ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span key={tag} dir="ltr" className="rounded-full bg-mist px-3 py-1 text-xs font-medium text-ink/70">
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <span className="mt-6 font-semibold text-cobalt">{t("readMore")} {locale === "fa" ? "←" : "→"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
