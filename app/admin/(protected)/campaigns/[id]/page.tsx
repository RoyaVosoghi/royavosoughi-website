import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignReview } from "@/components/admin/crm/CampaignReview";
import { EmptyState } from "@/components/admin/EmptyState";
import { getCampaign, getCampaignEmails } from "@/lib/admin/crm-docs";
import { canEditCrm } from "@/lib/admin/crm-page";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { isSegmentKey } from "@/lib/crm/segments";
import { isEmailConfigured } from "@/lib/email/crm";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Campaign · Admin" };

export default async function AdminCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getAdminTranslator("campaigns");
  const tc = await getAdminTranslator("crmDocs");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={tc("notConfiguredTitle")} body={tc("notConfiguredBody")} />;
  }

  const { id } = await params;
  const [campaign, emails, canEdit] = await Promise.all([getCampaign(id), getCampaignEmails(id), canEditCrm()]);
  if (!campaign) notFound();

  return (
    <div>
      <Link href="/admin/campaigns" className="text-sm font-medium text-cobalt hover:underline">
        {t("backLink")}
      </Link>
      <h1 className="text-section mt-4 text-ink" dir="auto">
        {campaign.name}
      </h1>
      <p className="mt-2 text-sm text-ink/60">{isSegmentKey(campaign.segmentKey) ? t(`segments.${campaign.segmentKey}`) : campaign.segmentKey}</p>
      <p className="mt-3 max-w-3xl text-ink/80" dir="auto">
        <span className="font-semibold">{t("goalLabel")}:</span> {campaign.goal}
      </p>
      <div className="mt-8">
        <CampaignReview campaignId={campaign.id} initialEmails={emails} emailConfigured={isEmailConfigured()} canEdit={canEdit} />
      </div>
    </div>
  );
}
