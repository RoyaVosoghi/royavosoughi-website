import { NextResponse } from "next/server";

import { audit, gate, jsonError } from "@/lib/admin/api";
import {
  createContract,
  findOrCreateContactForClient,
  getProposal,
  linkProposalToContract,
  logContactNote,
} from "@/lib/admin/crm-docs";
import { getContact } from "@/lib/admin/queries";
import { buildContractMarkdown } from "@/lib/crm/contract";
import { pickOption } from "@/lib/crm/proposal";

/**
 * Proposal → contract. The chosen package sets the fee, duration and payment
 * terms; phases, deliverables and exclusions carry over into their own
 * articles. A proposal written for someone who isn't a contact yet gets a
 * contact (and company) created here, so the contract has a CRM home.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) return jsonError("not_found", 404);
  if (proposal.status === "converted" && proposal.contractId) {
    return NextResponse.json({ ok: true, contractId: proposal.contractId });
  }
  if (proposal.status === "canceled" || proposal.status === "declined") return jsonError("locked", 409);

  try {
    const contact =
      (proposal.contactId ? await getContact(proposal.contactId) : null) ??
      (await findOrCreateContactForClient({
        name: proposal.clientName,
        email: proposal.clientEmail,
        company: proposal.clientCompany,
        phone: proposal.clientPhone,
        locale: proposal.locale,
      }));

    const option = pickOption(proposal.content, proposal.selectedOption);
    const bodyMd = buildContractMarkdown({
      locale: proposal.locale,
      clientName: proposal.clientName,
      clientCompany: proposal.clientCompany,
      clientEmail: proposal.clientEmail,
      projectTitle: proposal.title,
      phases: proposal.content.phases,
      deliverables: [...proposal.content.deliverables, ...(option?.features ?? []).filter((f) => !/^(everything|همه‌ی)/i.test(f))],
      exclusions: proposal.content.exclusions,
      amountCents: option?.priceCents ?? 0,
      currency: proposal.currency,
      paymentTerms: option?.paymentNote,
      durationLabel: option?.durationNote,
    });

    const contract = await createContract(
      {
        locale: proposal.locale,
        title: proposal.title,
        contactId: contact.id,
        dealId: proposal.dealId,
        companyId: contact.companyId,
        proposalId: proposal.id,
        clientName: proposal.clientName,
        clientEmail: proposal.clientEmail,
        clientCompany: proposal.clientCompany,
        bodyMd,
        amountCents: option?.priceCents ?? 0,
        currency: proposal.currency,
        startDate: null,
        durationLabel: option?.durationNote || null,
      },
      auth.admin.id,
    );

    await linkProposalToContract(proposal.id, contract.id, contact.id);
    await logContactNote(contact.id, proposal.dealId, `Proposal ${proposal.proposalNo} converted to contract ${contract.contractNo}`);
    await audit("proposal.convert", `${proposal.proposalNo} → ${contract.contractNo}`);
    return NextResponse.json({ ok: true, contractId: contract.id });
  } catch (err) {
    console.error("[admin/proposals] convert failed:", err);
    return jsonError("storage_failed", 500);
  }
}
