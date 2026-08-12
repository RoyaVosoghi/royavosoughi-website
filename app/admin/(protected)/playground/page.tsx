import { EmptyState } from "@/components/admin/EmptyState";
import { PlaygroundConsole } from "@/components/admin/PlaygroundConsole";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { MODEL_CATALOG } from "@/lib/ai/model-catalog";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Playground · Admin" };

export default async function AdminPlaygroundPage() {
  const t = await getAdminTranslator("playground");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("description")}</p>

      <div className="mt-8">
        <PlaygroundConsole defaultModel={MODEL_CATALOG[0].slug} />
      </div>
    </div>
  );
}
