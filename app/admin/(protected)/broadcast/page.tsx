import { BroadcastForm } from "@/components/admin/BroadcastForm";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Broadcast · Admin" };

export default async function AdminBroadcastPage() {
  const t = await getAdminTranslator("broadcast");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  return (
    <div>
      <p className="label-eyebrow text-cyan">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-soft">{t("title")}</h1>
      <p className="mt-3 text-soft/70">{t("subtitle")}</p>

      <div className="mt-8">
        <BroadcastForm />
      </div>
    </div>
  );
}
