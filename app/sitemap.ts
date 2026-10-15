import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { listPublishedPosts } from "@/lib/blog";
import { site } from "@/lib/site";

const paths = ["", "/about", "/blog"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${site.url}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${site.url}/${l}${path}`]),
        ),
      },
    })),
  );

  // Published posts only; each language version is its own URL.
  const posts = (await listPublishedPosts()).map((post) => ({
    url: `${site.url}/${post.locale}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [...pages, ...posts];
}
