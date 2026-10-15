import "server-only";

import type { ContactOption, DealOption } from "@/components/admin/crm/ProposalEditor";
import { getCurrentAdmin, roleAtLeast } from "@/lib/admin/auth";
import { getContacts, getDeals } from "@/lib/admin/queries";

/** Server-side helpers shared by the proposal/contract pages. */

export async function canEditCrm(): Promise<boolean> {
  const admin = await getCurrentAdmin();
  return Boolean(admin && roleAtLeast(admin.role, "operator"));
}

/** Slim, serialisable contact/deal lists for the editors' pickers. */
export async function getPickerOptions(): Promise<{ contacts: ContactOption[]; deals: DealOption[] }> {
  const [contacts, deals] = await Promise.all([getContacts({}, 500), getDeals({}, 500)]);
  return {
    contacts: contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, companyName: c.companyName })),
    deals: deals.map((d) => ({ id: d.id, title: d.title, contactId: d.contactId, currency: d.currency, amountCents: d.amountCents })),
  };
}
