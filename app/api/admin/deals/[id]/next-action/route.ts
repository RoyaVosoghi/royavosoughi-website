import { NextResponse } from "next/server";

import { requireRole } from "@/lib/admin/auth";
import { getActivities, getContact, getDeal, getPipelineStages, updateDealAiNextAction, writeAuditLog } from "@/lib/admin/queries";
import { suggestDealNextAction } from "@/lib/ai/deal-next-action";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("operator");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const { id } = await params;

  const deal = await getDeal(id);
  if (!deal) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [contact, stages, activities] = await Promise.all([
    getContact(deal.contactId),
    getPipelineStages(),
    getActivities({ dealId: id }, 10),
  ]);

  const stageName = stages.find((s) => s.id === deal.pipelineStageId)?.name ?? "Unknown";

  const suggestion = await suggestDealNextAction({
    title: deal.title,
    stageName,
    amountCents: deal.amountCents,
    currency: deal.currency,
    contactName: contact?.name ?? "Unknown",
    contactSummary: contact?.aiSummary ?? null,
    recentActivities: activities.map((a) => ({
      type: a.type,
      subject: a.subject,
      createdAt: a.createdAt,
      completedAt: a.completedAt,
    })),
  });

  if (!suggestion) {
    return NextResponse.json({ error: "suggestion_failed" }, { status: 502 });
  }

  try {
    await updateDealAiNextAction(id, suggestion);
    await writeAuditLog("deal.next_action_regenerate", id);
  } catch (err) {
    console.error("[admin/deals] next-action persist failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, suggestion });
}
