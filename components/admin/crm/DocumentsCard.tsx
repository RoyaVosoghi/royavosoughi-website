import Link from "next/link";

import { getContracts, getProposals, type Contract, type Proposal } from "@/lib/admin/crm-docs";
import { getAdminTranslator } from "@/lib/admin/i18n/server";

import { StatusChip } from "./ui";

/**
 * Proposals + contracts for one contact, with shortcuts to start new ones
 * (pre-filled from the contact, and the deal when given). Renders nothing
 * but the shortcuts if the V5 tables don't exist yet.
 */
export async function DocumentsCard({ contactId, dealId }: { contactId: string; dealId?: string }) {
  const [tp, tk, tc] = await Promise.all([getAdminTranslator("proposals"), getAdminTranslator("contracts"), getAdminTranslator("crmDocs")]);

  let proposals: Proposal[] = [];
  let contracts: Contract[] = [];
  try {
    [proposals, contracts] = await Promise.all([getProposals({ contactId }, 20), getContracts({ contactId }, 20)]);
  } catch {
    // V5 tables not created yet — the shortcuts below still explain where to go.
  }
  if (dealId) {
    proposals = proposals.filter((p) => p.dealId === dealId);
    contracts = contracts.filter((c) => c.dealId === dealId);
  }

  const query = new URLSearchParams({ contactId, ...(dealId ? { dealId } : {}) }).toString();
  const rows = [
    ...proposals.map((p) => ({ href: `/admin/proposals/${p.id}`, no: p.proposalNo, title: p.title, status: p.status, at: p.updatedAt })),
    ...contracts.map((c) => ({ href: `/admin/contracts/${c.id}`, no: c.contractNo, title: c.title, status: c.status, at: c.updatedAt })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section className="rounded-3xl border-2 border-ink/10 bg-canvas p-6">
      <h2 className="font-display text-lg font-bold text-ink">
        {tp("title")} · {tk("title")}
      </h2>
      {rows.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.href}>
              <Link href={row.href} className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-mist/20 px-4 py-3 hover:bg-mist/40">
                <span className="min-w-0">
                  <span dir="ltr" className="block font-mono text-[11px] text-ink/50">
                    {row.no}
                  </span>
                  <span className="block truncate text-sm font-medium text-ink/85" dir="auto">
                    {row.title}
                  </span>
                </span>
                <StatusChip status={row.status} label={tc(`status.${row.status}`)} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/admin/proposals/new?${query}`} className="rounded-full bg-cobalt px-4 py-2 text-xs font-semibold text-white hover:bg-cobalt-dark">
          {tp("newButton")}
        </Link>
        <Link href={`/admin/contracts/new?${query}`} className="rounded-full border-2 border-ink/20 px-4 py-1.5 text-xs font-semibold text-ink hover:bg-mist/40">
          {tk("newButton")}
        </Link>
      </div>
    </section>
  );
}
