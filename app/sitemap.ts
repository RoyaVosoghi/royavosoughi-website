import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { site } from "@/lib/site";

const paths = ["", "/about"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.flatMap((path) =>
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
}
