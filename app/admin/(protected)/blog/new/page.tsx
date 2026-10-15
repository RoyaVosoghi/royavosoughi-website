import Link from "next/link";

import { BlogEditor } from "@/components/admin/BlogEditor";
import { getCurrentAdmin, roleAtLeast } from "@/lib/admin/auth";
import { getAdminTranslator } from "@/lib/admin/i18n/server";

export const metadata = { title: "New post · Admin" };

export default async function AdminNewBlogPostPage() {
  const [t, admin] = await Promise.all([getAdminTranslator("blogAdmin"), getCurrentAdmin()]);
  return (
    <div>
      <Link href="/admin/blog" className="text-sm font-medium text-cobalt hover:underline">
        {t("backLink")}
      </Link>
      <h1 className="text-section mt-4 mb-6 text-ink">{t("newTitle")}</h1>
      <BlogEditor post={null} canEdit={Boolean(admin && roleAtLeast(admin.role, "editor"))} />
    </div>
  );
}
