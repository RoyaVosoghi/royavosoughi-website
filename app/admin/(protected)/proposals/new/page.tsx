import Link from "next/link";

import { ProposalEditor } from "@/components/admin/crm/ProposalEditor";
import { EmptyState } from "@/components/admin/EmptyState";
import { canEditCrm, getPickerOptions } from "@/lib/admin/crm-page";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "New proposal · Admin" };
export const maxDuration = 60;

export default async function AdminNewProposalPage({ searchParams }: { searchParams: Promise<{ contactId?: string; dealId?: string }> }) {
  const t = await getAdminTranslator("proposals");
  const tc = await getAdminTranslator("crmDocs");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={tc("notConfiguredTitle")} body={tc("notConfiguredBody")} />;
  }

  const [{ contactId, dealId }, options, canEdit] = await Promise.all([searchParams, getPickerOptions(), canEditCrm()]);

  return (
    <div>
      <Link href="/admin/proposals" className="text-sm font-medium text-cobalt hover:underline">
        {t("backLink")}
      </Link>
      <h1 className="text-section mt-4 mb-6 text-ink">{t("newTitle")}</h1>
      <ProposalEditor proposal={null} comments={[]} contacts={options.contacts} deals={options.deals} canEdit={canEdit} prefill={{ contactId, dealId }} />
    </div>
  );
}
