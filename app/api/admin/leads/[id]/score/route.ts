import { NextResponse } from "next/server";

import { requireRole } from "@/lib/admin/auth";
import { getConversationMessages, getLead, updateLeadAiScore, writeAuditLog } from "@/lib/admin/queries";
import { scoreLead } from "@/lib/ai/lead-score";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("operator");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const { id } = await params;

  const lead = await getLead(id);
  if (!lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const transcript = lead.conversationId ? await getConversationMessages(lead.conversationId) : undefined;

  const result = await scoreLead({
    name: lead.name,
    email: lead.email,
    interest: lead.interest,
    source: lead.source,
    companyName: lead.companyName,
    transcript: transcript?.slice(-30).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
  });

  if (!result) {
    return NextResponse.json({ error: "scoring_failed" }, { status: 502 });
  }

  try {
    await updateLeadAiScore(id, { score: result.score, reason: result.reasoning });
    await writeAuditLog("lead.score", id);
  } catch (err) {
    console.error("[admin/leads] score persist failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result });
}
