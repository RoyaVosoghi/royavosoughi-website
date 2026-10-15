import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Body of create/update requests from the blog editor. */
export const BlogPostSchema = z.object({
  locale: z.enum(["en", "fa"]),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(400),
  bodyMd: z.string().max(100_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  status: z.enum(["draft", "published"]),
});

/** Public blog pages are ISR-cached — refresh them the moment a post changes. */
export function revalidateBlog(locale: string, slug: string) {
  revalidatePath(`/${locale}/blog`);
  revalidatePath(`/${locale}/blog/${slug}`);
  revalidatePath("/sitemap.xml");
}
