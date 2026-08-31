import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getCompany, getContacts, getDeals } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Company · Admin" };

export default async function AdminCompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getAdminTranslator("companies");
  const { id } = await params;

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const company = await getCompany(id);
  if (!company) notFound();

  const [contacts, deals] = await Promise.all([getContacts({ companyId: id }), getDeals({})]);
  const companyDeals = deals.filter((d) => d.companyId === id);

  return (
    <div>
      <Link href="/admin/companies" className="text-sm font-medium text-emerald hover:underline">
        {t("detail.backLink")}
      </Link>

      <h1 className="text-section mt-4 text-forest">{company.name}</h1>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6 lg:col-span-1">
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">{t("detail.fieldDomain")}</dt>
              <dd className="mt-0.5 text-ink/80">{company.domain ?? t("detail.notSet")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">{t("detail.fieldIndustry")}</dt>
              <dd className="mt-0.5 text-ink/80">{company.industry ?? t("detail.notSet")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">{t("detail.fieldNotes")}</dt>
              <dd className="mt-0.5 text-ink/80">{company.notes ?? t("detail.notSet")}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6 lg:col-span-1">
          <h2 className="font-display text-lg font-bold text-forest">{t("detail.contactsTitle")}</h2>
          {contacts.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">{t("detail.contactsEmpty")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {contacts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/contacts/${c.id}`}
                    className="block rounded-2xl border border-forest/10 bg-mint/20 px-4 py-3 text-sm font-medium text-ink/85 hover:bg-mint/40"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6 lg:col-span-1">
          <h2 className="font-display text-lg font-bold text-forest">{t("detail.dealsTitle")}</h2>
          {companyDeals.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">{t("detail.dealsEmpty")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {companyDeals.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/admin/deals/${d.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-forest/10 bg-mint/20 px-4 py-3 hover:bg-mint/40"
                  >
                    <span className="text-sm font-medium text-ink/85">{d.title}</span>
                    <span className="text-sm font-semibold text-forest">
                      {(d.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: d.currency })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
