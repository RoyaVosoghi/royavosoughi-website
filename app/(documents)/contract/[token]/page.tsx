import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContractClientView } from "@/components/docs/ContractClientView";
import { getContractByToken, recordContractView } from "@/lib/admin/crm-docs";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  if (!isSupabaseServiceConfigured()) return {};
  const contract = await getContractByToken((await params).token).catch(() => null);
  return contract ? { title: `${contract.contractNo} · ${contract.title} · Roya Vosoughi` } : {};
}

export default async function PublicContractPage({ params }: { params: Promise<{ token: string }> }) {
  if (!isSupabaseServiceConfigured()) notFound();
  const { token } = await params;
  const contract = await getContractByToken(token);
  if (!contract || contract.status === "draft") notFound();

  // First visit after sending flips sent → viewed (the admin sees "first opened").
  await recordContractView(contract);

  return (
    <ContractClientView
      token={token}
      contract={{
        locale: contract.locale,
        title: contract.title,
        contractNo: contract.contractNo,
        clientName: contract.clientName,
        clientCompany: contract.clientCompany,
        bodyMd: contract.bodyMd,
        issuedAt: contract.sentAt ?? contract.createdAt,
        status: contract.status,
        acceptedByName: contract.acceptedByName,
        acceptedAt: contract.acceptedAt,
        acceptedIp: contract.acceptedIp,
        copySent: Boolean(contract.acceptedCopySentAt),
      }}
    />
  );
}
