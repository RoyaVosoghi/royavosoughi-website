import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityListSection } from "@/components/admin/ActivityListSection";
import { DealEditForm } from "@/components/admin/DealEditForm";
import { EmptyState } from "@/components/admin/EmptyState";
import { SuggestNextActionButton } from "@/components/admin/SuggestNextActionButton";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getActivities, getContact, getDeal, getPipelineStages } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Deal · Admin" };

export default async function AdminDealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getAdminTranslator("deals");
  const { id } = await params;

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const deal = await getDeal(id);
  if (!deal) notFound();

  const [stages, contact, activities] = await Promise.all([
    getPipelineStages(),
    getContact(deal.contactId),
    getActivities({ dealId: id }),
  ]);

  return (
    <div>
      <Link href="/admin/deals" className="text-sm font-medium text-emerald hover:underline">
        {t("detail.backLink")}
      </Link>

      <h1 className="text-section mt-4 text-forest">{deal.title}</h1>
      {contact ? (
        <p className="mt-1 text-ink/70">
          {t("detail.fieldContact")}:{" "}
          <Link href={`/admin/contacts/${contact.id}`} className="text-emerald hover:underline">
            {contact.name}
          </Link>
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <DealEditForm deal={deal} stages={stages} />

          <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-bold text-forest">{t("detail.aiNextActionTitle")}</h2>
              <SuggestNextActionButton dealId={deal.id} />
            </div>
            {deal.aiNextAction ? (
              <>
                <p className="mt-3 text-sm text-ink/80">{deal.aiNextAction}</p>
                {deal.aiNextActionUpdatedAt ? (
                  <p className="mt-2 text-xs text-ink/40">
                    {t("detail.aiNextActionUpdatedAt", { when: new Date(deal.aiNextActionUpdatedAt).toLocaleString() })}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-sm text-ink/50">{t("detail.aiNextActionEmpty")}</p>
            )}
          </section>
        </div>

        <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
          <h2 className="font-display text-lg font-bold text-forest">{t("detail.activitiesTitle")}</h2>
          <div className="mt-3">
            <ActivityListSection activities={activities} contactId={deal.contactId} dealId={deal.id} />
          </div>
        </section>
      </div>
    </div>
  );
}
