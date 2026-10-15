import Link from "next/link";

import { ContractEditor } from "@/components/admin/crm/ContractEditor";
import { EmptyState } from "@/components/admin/EmptyState";
import { canEditCrm, getPickerOptions } from "@/lib/admin/crm-page";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "New contract · Admin" };

export default async function AdminNewContractPage({ searchParams }: { searchParams: Promise<{ contactId?: string; dealId?: string }> }) {
  const t = await getAdminTranslator("contracts");
  const tc = await getAdminTranslator("crmDocs");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={tc("notConfiguredTitle")} body={tc("notConfiguredBody")} />;
  }

  const [{ contactId, dealId }, options, canEdit] = await Promise.all([searchParams, getPickerOptions(), canEditCrm()]);

  return (
    <div>
      <Link href="/admin/contracts" className="text-sm font-medium text-cobalt hover:underline">
        {t("backLink")}
      </Link>
      <h1 className="text-section mt-4 mb-6 text-ink">{t("newTitle")}</h1>
      <ContractEditor contract={null} contacts={options.contacts} deals={options.deals} canEdit={canEdit} proposalLink={null} prefill={{ contactId, dealId }} />
    </div>
  );
}
