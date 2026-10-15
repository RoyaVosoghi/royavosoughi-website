import Link from "next/link";

import { StatusChip } from "@/components/admin/crm/ui";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getCurrentAdmin, roleAtLeast } from "@/lib/admin/auth";
import { isMissingTableError } from "@/lib/admin/crm-docs";
import { getAdminLocale, getAdminTranslator } from "@/lib/admin/i18n/server";
import { getAllPosts, type BlogPost } from "@/lib/blog";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Blog · Admin" };

export default async function AdminBlogPage() {
  const t = await getAdminTranslator("blogAdmin");
  const tc = await getAdminTranslator("crmDocs");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={tc("notConfiguredTitle")} body={tc("notConfiguredBody")} />;
  }

  let posts: BlogPost[];
  try {
    posts = await getAllPosts();
  } catch (err) {
    if (isMissingTableError(err)) {
      return <EmptyState title={t("tableMissingTitle")} body={t("tableMissingBody")} />;
    }
    throw err;
  }
  const [locale, admin] = await Promise.all([getAdminLocale(), getCurrentAdmin()]);
  const canEdit = Boolean(admin && roleAtLeast(admin.role, "editor"));
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium" }) : "—";

  const columns: Column<BlogPost>[] = [
    {
      header: t("columnTitle"),
      cell: (row) => (
        <Link href={`/admin/blog/${row.id}`} className="font-medium text-ink hover:underline" dir={row.locale === "fa" ? "rtl" : "ltr"}>
          {row.title}
        </Link>
      ),
    },
    { header: t("columnLanguage"), cell: (row) => <span className="font-mono text-xs uppercase">{row.locale}</span> },
    {
      header: t("columnStatus"),
      cell: (row) => <StatusChip status={row.status === "published" ? "accepted" : "draft"} label={row.status === "published" ? t("published") : t("draft")} />,
    },
    { header: t("columnPublished"), numeric: true, cell: (row) => fmt(row.publishedAt) },
    { header: t("columnUpdated"), numeric: true, cell: (row) => fmt(row.updatedAt) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow text-cobalt">{t("eyebrow")}</p>
          <h1 className="text-section mt-3 text-ink">{t("title")}</h1>
          <p className="mt-3 max-w-3xl text-ink/70">{t("subtitle")}</p>
        </div>
        {canEdit ? (
          <Link href="/admin/blog/new" className="rounded-full bg-cobalt px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cobalt-dark">
            {t("newButton")}
          </Link>
        ) : null}
      </div>
      <div className="mt-8">
        {posts.length === 0 ? <EmptyState title={t("emptyTitle")} body={t("emptyBody")} /> : <DataTable columns={columns} rows={posts} />}
      </div>
    </div>
  );
}
