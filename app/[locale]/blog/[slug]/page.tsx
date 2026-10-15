import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Markdown } from "@/components/blog/Markdown";
import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { formatPostDate, getPublishedLocalesForSlug, getPublishedPost, readingMinutes, type BlogLocale } from "@/lib/blog";
import { site } from "@/lib/site";

export const revalidate = 300;

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPublishedPost(locale as BlogLocale, slug);
  if (!post) return {};
  const locales = await getPublishedLocalesForSlug(slug);
  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/${locale}/blog/${slug}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/blog/${slug}`])),
    },
    openGraph: { type: "article", title: post.title, description: post.excerpt, publishedTime: post.publishedAt ?? undefined },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getPublishedPost(locale as BlogLocale, slug);
  if (!post) notFound();

  const t = await getTranslations("blog");
  const otherLocale = locale === "fa" ? "en" : "fa";
  const hasOther = (await getPublishedLocalesForSlug(slug)).includes(otherLocale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    inLanguage: locale,
    author: { "@type": "Person", name: site.founder, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}/blog/${slug}`,
  };

  return (
    <Section tone="light" className="pt-14 md:pt-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/blog" className="text-sm font-medium text-cobalt hover:underline">
            {t("backToBlog")}
          </Link>
          {hasOther ? (
            <Link href={`/blog/${slug}`} locale={otherLocale} className="text-sm font-medium text-ink/60 hover:text-cobalt">
              {t("otherLanguage")}
            </Link>
          ) : null}
        </div>
        <p className="mt-8 text-sm text-ink/60">
          {formatPostDate(post.publishedAt, locale)} · {t("minutes", { count: readingMinutes(post.bodyMd) })}
        </p>
        <h1 className="text-section mt-4 text-ink">{post.title}</h1>
        {post.excerpt ? <p className="mt-6 text-xl text-ink/75">{post.excerpt}</p> : null}
        <hr className="my-10 border-ink/10" />
        <Markdown source={post.bodyMd} />

        <aside className="mt-16 rounded-3xl bg-ink p-8 text-canvas md:p-10">
          <h2 className="text-2xl text-canvas">{t("ctaTitle")}</h2>
          <p className="mt-3 text-mist">{t("ctaBody")}</p>
          <div className="mt-6">
            <ButtonLink href={`/${locale}#contact`}>{t("ctaButton")}</ButtonLink>
          </div>
        </aside>
      </article>
    </Section>
  );
}
