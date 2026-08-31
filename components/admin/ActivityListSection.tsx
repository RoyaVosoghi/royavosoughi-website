import { ActivityCompleteButton } from "@/components/admin/ActivityCompleteButton";
import { ActivityQuickAddForm } from "@/components/admin/ActivityQuickAddForm";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import type { Activity } from "@/lib/admin/queries";

/** Embedded on contact + deal detail pages — server-rendered list of that entity's activities, plus a scoped quick-add form. */
export async function ActivityListSection({
  activities,
  contactId,
  dealId,
}: {
  activities: Activity[];
  contactId: string;
  dealId?: string | null;
}) {
  const t = await getAdminTranslator("activities");

  return (
    <div className="flex flex-col gap-4">
      {activities.length === 0 ? (
        <p className="text-sm text-ink/50">{t("emptyTitle")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {activities.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-forest/10 bg-mint/20 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ink/85">
                  <span className="me-2 rounded-full bg-forest/10 px-2 py-0.5 text-xs font-semibold text-forest capitalize">
                    {a.type}
                  </span>
                  {a.subject}
                </p>
                {a.dueAt ? <p className="mt-1 text-xs text-ink/50">{new Date(a.dueAt).toLocaleString()}</p> : null}
              </div>
              <ActivityCompleteButton id={a.id} completed={Boolean(a.completedAt)} />
            </li>
          ))}
        </ul>
      )}
      <ActivityQuickAddForm contactId={contactId} dealId={dealId} />
    </div>
  );
}
