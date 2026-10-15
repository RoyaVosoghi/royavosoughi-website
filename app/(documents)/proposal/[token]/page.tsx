import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProposalClientView } from "@/components/docs/ProposalClientView";
import { getProposalByToken, getProposalComments, recordProposalView } from "@/lib/admin/crm-docs";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  if (!isSupabaseServiceConfigured()) return {};
  const proposal = await getProposalByToken((await params).token).catch(() => null);
  return proposal ? { title: `${proposal.proposalNo} · ${proposal.title} · Roya Vosoughi` } : {};
}

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  if (!isSupabaseServiceConfigured()) notFound();
  const { token } = await params;
  const proposal = await getProposalByToken(token);
  // Drafts have never been sent — their link must not work yet.
  if (!proposal || proposal.status === "draft") notFound();

  if (proposal.status !== "canceled") await recordProposalView(proposal);
  const comments = await getProposalComments(proposal.id);

  return (
    <ProposalClientView
      token={token}
      proposal={{
        locale: proposal.locale,
        title: proposal.title,
        proposalNo: proposal.proposalNo,
        revision: proposal.revision,
        clientName: proposal.clientName,
        clientCompany: proposal.clientCompany,
        clientEmail: proposal.clientEmail,
        currency: proposal.currency,
        validUntil: proposal.validUntil,
        issuedAt: proposal.sentAt ?? proposal.createdAt,
        status: proposal.status,
        selectedOption: proposal.selectedOption,
        responderName: proposal.responderName,
        respondedAt: proposal.respondedAt,
        content: proposal.content,
      }}
      comments={comments.map((c) => ({ id: c.id, author: c.author, body: c.body, createdAt: c.createdAt }))}
    />
  );
}
