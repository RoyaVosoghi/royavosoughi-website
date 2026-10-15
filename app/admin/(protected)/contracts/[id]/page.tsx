import Link from "next/link";
import { notFound } from "next/navigation";

import { ContractEditor } from "@/components/admin/crm/ContractEditor";
import { EmptyState } from "@/components/admin/EmptyState";
import { getContract, getProposal } from "@/lib/admin/crm-docs";
import { canEditCrm, getPickerOptions } from "@/lib/admin/crm-page";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Contract · Admin" };
export const maxDuration = 60;

export default async function AdminContractPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getAdminTranslator("contracts");
  const tc = await getAdminTranslator("crmDocs");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={tc("notConfiguredTitle")} body={tc("notConfiguredBody")} />;
  }

  const { id } = await params;
  const [contract, options, canEdit] = await Promise.all([getContract(id), getPickerOptions(), canEditCrm()]);
  if (!contract) notFound();
  const proposal = contract.proposalId ? await getProposal(contract.proposalId) : null;

  return (
    <div>
      <Link href="/admin/contracts" className="text-sm font-medium text-cobalt hover:underline">
        {t("backLink")}
      </Link>
      <h1 className="text-section mt-4 mb-6 text-ink" dir="auto">
        {contract.title}
      </h1>
      <ContractEditor
        key={contract.id}
        contract={contract}
        contacts={options.contacts}
        deals={options.deals}
        canEdit={canEdit}
        proposalLink={proposal ? { id: proposal.id, no: proposal.proposalNo } : null}
      />
    </div>
  );
}
