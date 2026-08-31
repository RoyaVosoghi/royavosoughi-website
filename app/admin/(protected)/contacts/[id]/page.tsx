import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityListSection } from "@/components/admin/ActivityListSection";
import { ContactStatusSelect } from "@/components/admin/ContactStatusSelect";
import { EmptyState } from "@/components/admin/EmptyState";
import { RegenerateSummaryButton } from "@/components/admin/RegenerateSummaryButton";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getActivities, getContact, getContactTimeline, getDeals } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Contact · Admin" };

export default async function AdminContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getAdminTranslator("contacts");
  const { id } = await params;

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const contact = await getContact(id);
  if (!contact) notFound();

  const [timeline, deals, activities] = await Promise.all([
    getContactTimeline(id),
    getDeals({ contactId: id }),
    getActivities({ contactId: id }),
  ]);

  return (
    <div>
      <Link href="/admin/contacts" className="text-sm font-medium text-emerald hover:underline">
        {t("detail.backLink")}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-section text-forest">{contact.name}</h1>
          <p className="mt-1 text-ink/70">{contact.email}</p>
          <p className="mt-1 text-sm text-ink/50">
            {contact.companyId ? (
              <Link href={`/admin/companies/${contact.companyId}`} className="text-emerald hover:underline">
                {contact.companyName}
              </Link>
            ) : (
              t("detail.noCompany")
            )}
          </p>
        </div>
        <ContactStatusSelect id={contact.id} status={contact.status} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-bold text-forest">{t("detail.aiSummaryTitle")}</h2>
              <RegenerateSummaryButton contactId={contact.id} />
            </div>
            {contact.aiSummary ? (
              <>
                <p className="mt-3 text-sm text-ink/80">{contact.aiSummary}</p>
                {contact.aiSummaryUpdatedAt ? (
                  <p className="mt-2 text-xs text-ink/40">
                    {t("detail.aiSummaryUpdatedAt", { when: new Date(contact.aiSummaryUpdatedAt).toLocaleString() })}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-sm text-ink/50">{t("detail.aiSummaryEmpty")}</p>
            )}
          </section>

          <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
            <h2 className="font-display text-lg font-bold text-forest">{t("detail.timelineTitle")}</h2>
            {timeline.length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">{t("detail.timelineEmpty")}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {timeline.map((item) =>
                  item.kind === "activity" ? (
                    <li key={`a-${item.id}`} className="rounded-2xl border border-forest/10 bg-mint/20 px-4 py-3">
                      <p className="text-sm font-medium text-ink/85">
                        <span className="me-2 rounded-full bg-forest/10 px-2 py-0.5 text-xs font-semibold text-forest capitalize">
                          {item.type}
                        </span>
                        {item.subject}
                      </p>
                      <p className="mt-1 text-xs text-ink/40">{new Date(item.createdAt).toLocaleString()}</p>
                    </li>
                  ) : (
                    <li
                      key={`c-${item.id}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-forest/10 bg-mint/20 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink/85">
                          {t("detail.timelineConversation", { channel: item.channel })}
                        </p>
                        <p className="mt-1 text-xs text-ink/40">{new Date(item.lastActiveAt).toLocaleString()}</p>
                      </div>
                      <Link href={`/admin/conversations/${item.id}`} className="text-sm font-medium text-emerald hover:underline">
                        {t("detail.viewConversation")}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">{t("detail.fieldPhone")}</dt>
                <dd className="mt-0.5 text-ink/80">{contact.phone ?? t("detail.notSet")}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">{t("detail.fieldTitle")}</dt>
                <dd className="mt-0.5 text-ink/80">{contact.title ?? t("detail.notSet")}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">{t("detail.fieldSource")}</dt>
                <dd className="mt-0.5 text-ink/80">{contact.source ?? t("detail.notSet")}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink/40">{t("detail.fieldLocale")}</dt>
                <dd className="mt-0.5 text-ink/80">{contact.locale.toUpperCase()}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
            <h2 className="font-display text-lg font-bold text-forest">{t("detail.dealsTitle")}</h2>
            {deals.length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">{t("detail.dealsEmpty")}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {deals.map((deal) => (
                  <li key={deal.id}>
                    <Link
                      href={`/admin/deals/${deal.id}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-forest/10 bg-mint/20 px-4 py-3 hover:bg-mint/40"
                    >
                      <span className="text-sm font-medium text-ink/85">{deal.title}</span>
                      <span className="text-sm font-semibold text-forest">
                        {(deal.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: deal.currency })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
            <h2 className="font-display text-lg font-bold text-forest">{t("detail.activitiesTitle")}</h2>
            <div className="mt-3">
              <ActivityListSection activities={activities} contactId={contact.id} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
