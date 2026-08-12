import { redirect } from "next/navigation";

import { TeamManager } from "@/components/admin/TeamManager";
import { EmptyState } from "@/components/admin/EmptyState";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getAdminUsers } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Team & roles · Admin" };

export default async function AdminTeamPage() {
  const t = await getAdminTranslator("team");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.role !== "owner") {
    return <EmptyState title={t("ownerOnlyTitle")} body={t("ownerOnlyBody")} />;
  }

  const users = await getAdminUsers();

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8">
        <TeamManager initial={users} currentAdminId={admin.id} />
      </div>
    </div>
  );
}
