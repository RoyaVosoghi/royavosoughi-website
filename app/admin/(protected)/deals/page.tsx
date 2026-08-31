import { AddDealForm } from "@/components/admin/AddDealForm";
import { DealsBoard } from "@/components/admin/DealsBoard";
import { EmptyState } from "@/components/admin/EmptyState";
import { StageManagerToggle } from "@/components/admin/StageManagerToggle";
import { getCurrentAdmin, roleAtLeast } from "@/lib/admin/auth";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getContacts, getDeals, getPipelineStages } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Deals · Admin" };

export default async function AdminDealsPage() {
  const t = await getAdminTranslator("deals");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const [stages, deals, contacts, admin] = await Promise.all([
    getPipelineStages(),
    getDeals(),
    getContacts(),
    getCurrentAdmin(),
  ]);

  const canManageStages = admin ? roleAtLeast(admin.role, "admin") : false;
  const firstOpenStage = stages.find((s) => !s.isWon && !s.isLost) ?? stages[0];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
          <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
          <p className="mt-3 text-ink/70">{t("subtitle")}</p>
        </div>
        {canManageStages ? <StageManagerToggle stages={stages} /> : null}
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <AddDealForm contacts={contacts} defaultStageId={firstOpenStage?.id ?? ""} />
        <DealsBoard stages={stages} deals={deals} />
      </div>
    </div>
  );
}
