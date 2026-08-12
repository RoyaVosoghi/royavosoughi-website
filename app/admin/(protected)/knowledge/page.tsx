import { DocumentTable } from "@/components/admin/DocumentTable";
import { DocumentUploadForm } from "@/components/admin/DocumentUploadForm";
import { EmptyState } from "@/components/admin/EmptyState";
import { RagTestSearch } from "@/components/admin/RagTestSearch";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getDocuments } from "@/lib/ai/documents";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Knowledge base · Admin" };

export default async function AdminKnowledgePage() {
  const t = await getAdminTranslator("knowledge");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const documents = await getDocuments();

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">
        {t("descriptionBefore")} <span className="font-mono">npm run ingest</span>
        {t("descriptionAfter")}
      </p>

      <div className="mt-8 flex flex-col gap-8">
        <DocumentUploadForm />
        <DocumentTable documents={documents} />
        <RagTestSearch />
      </div>
    </div>
  );
}
