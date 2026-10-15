import Link from "next/link";
import { notFound } from "next/navigation";

import { ProposalEditor } from "@/components/admin/crm/ProposalEditor";
import { EmptyState } from "@/components/admin/EmptyState";
import { getProposal, getProposalComments } from "@/lib/admin/crm-docs";
import { canEditCrm, getPickerOptions } from "@/lib/admin/crm-page";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Proposal · Admin" };
export const maxDuration = 60;

export default async function AdminProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getAdminTranslator("proposals");
  const tc = await getAdminTranslator("crmDocs");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={tc("notConfiguredTitle")} body={tc("notConfiguredBody")} />;
  }

  const { id } = await params;
  const [proposal, comments, options, canEdit] = await Promise.all([getProposal(id), getProposalComments(id), getPickerOptions(), canEditCrm()]);
  if (!proposal) notFound();

  return (
    <div>
      <Link href="/admin/proposals" className="text-sm font-medium text-cobalt hover:underline">
        {t("backLink")}
      </Link>
      <h1 className="text-section mt-4 mb-6 text-ink" dir="auto">
        {proposal.title}
      </h1>
      <ProposalEditor
        key={proposal.id}
        proposal={proposal}
        comments={comments}
        contacts={options.contacts}
        deals={options.deals}
        canEdit={canEdit}
      />
    </div>
  );
}
