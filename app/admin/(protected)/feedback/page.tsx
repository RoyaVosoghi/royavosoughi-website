import Link from "next/link";

import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getConversations, getFeedback, getUnansweredQuestions, type FeedbackRow } from "@/lib/admin/queries";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Feedback · Admin" };

function buildColumns(
  t: Awaited<ReturnType<typeof getAdminTranslator<"feedback">>>,
): Column<FeedbackRow>[] {
  return [
    {
      header: t("columnRating"),
      cell: (row) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            row.rating === 1 ? "bg-mist text-coral-deep" : "bg-amber/20 text-amber-deep"
          }`}
        >
          {row.rating === 1 ? t("ratingGood") : t("ratingBad")}
        </span>
      ),
    },
    { header: t("columnReply"), cell: (row) => <span className="line-clamp-2 max-w-md">{row.messageContent}</span> },
    { header: t("columnComment"), cell: (row) => row.comment ?? "—" },
    {
      header: t("columnConversation"),
      cell: (row) =>
        row.conversationId ? (
          <Link href={`/admin/conversations/${row.conversationId}`} className="text-coral-deep hover:underline">
            {t("viewLink")}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      header: t("columnGiven"),
      numeric: true,
      cell: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];
}

export default async function AdminFeedbackPage() {
  const t = await getAdminTranslator("feedback");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const [feedback, flagged, unanswered] = await Promise.all([
    getFeedback(),
    getConversations({ flagged: true }),
    getUnansweredQuestions(),
  ]);
  const columns = buildColumns(t);

  return (
    <div>
      <p className="label-eyebrow text-coral-deep">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-navy">{t("title")}</h1>
      <p className="mt-3 text-navy/70">{t("subtitle")}</p>

      <div className="mt-8">
        <h2 className="font-display text-lg font-bold text-navy">{t("ratingsTitle")}</h2>
        <div className="mt-4">
          {feedback.length === 0 ? (
            <EmptyState title={t("emptyRatingsTitle")} body={t("emptyRatingsBody")} />
          ) : (
            <DataTable columns={columns} rows={feedback} />
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-bold text-navy">{t("flaggedTitle")}</h2>
        <p className="mt-1 text-sm text-navy/60">{t("flaggedSubtitle")}</p>
        <div className="mt-4">
          {flagged.length === 0 ? (
            <p className="text-sm text-navy/60">{t("flaggedEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {flagged.map((c) => (
                <li key={c.id} className="rounded-xl border border-navy/10 bg-mist/20 p-3 text-sm">
                  <Link href={`/admin/conversations/${c.id}`} className="font-semibold text-coral-deep hover:underline">
                    {c.channel} · {c.leadEmail ?? t("anonymous")} →
                  </Link>
                  <span className="ms-2 text-navy/50">{new Date(c.lastActiveAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-bold text-navy">{t("unansweredTitle")}</h2>
        <p className="mt-1 text-sm text-navy/60">{t("unansweredSubtitle")}</p>
        <div className="mt-4">
          {unanswered.length === 0 ? (
            <p className="text-sm text-navy/60">{t("unansweredEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {unanswered.map((u) => (
                <li key={u.messageId} className="rounded-xl border border-navy/10 bg-canvas p-3 text-sm">
                  <p className="font-medium text-navy/80">{u.question ?? t("noQuestionCaptured")}</p>
                  <p className="mt-1 text-navy/50 line-clamp-2">{u.reply}</p>
                  <div className="mt-2 flex gap-3">
                    <Link href={`/admin/conversations/${u.conversationId}`} className="text-xs font-semibold text-coral-deep hover:underline">
                      {t("viewConversation")}
                    </Link>
                    <Link href="/admin/knowledge" className="text-xs font-semibold text-navy hover:underline">
                      {t("addToKnowledgeBase")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
