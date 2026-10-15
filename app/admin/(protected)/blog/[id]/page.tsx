import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogEditor } from "@/components/admin/BlogEditor";
import { getCurrentAdmin, roleAtLeast } from "@/lib/admin/auth";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getPost } from "@/lib/blog";

export const metadata = { title: "Post · Admin" };

export default async function AdminBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, admin, post] = await Promise.all([getAdminTranslator("blogAdmin"), getCurrentAdmin(), getPost(id)]);
  if (!post) notFound();
  return (
    <div>
      <Link href="/admin/blog" className="text-sm font-medium text-cobalt hover:underline">
        {t("backLink")}
      </Link>
      <h1 className="text-section mt-4 mb-6 text-ink" dir={post.locale === "fa" ? "rtl" : "ltr"}>
        {post.title}
      </h1>
      <BlogEditor key={post.id} post={post} canEdit={Boolean(admin && roleAtLeast(admin.role, "editor"))} />
    </div>
  );
}
