import { NextResponse } from "next/server";

import { requireRole } from "@/lib/admin/auth";
import { getConversationMessages, getLeads, updateLeadAiScore, writeAuditLog } from "@/lib/admin/queries";
import { scoreLead } from "@/lib/ai/lead-score";

const BATCH_CAP = 25;

/** Scores every lead that doesn't have an ai_score yet, sequentially and fully awaited (no background/fire-and-forget — this route only returns once every call has settled). Capped so one click can't trigger an unbounded number of LLM calls. */
export async function POST() {
  const gate = await requireRole("operator");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const leads = await getLeads(500);
  const unscored = leads.filter((l) => l.aiScore === null).slice(0, BATCH_CAP);

  let scored = 0;
  let failed = 0;

  for (const lead of unscored) {
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
      failed += 1;
      continue;
    }

    try {
      await updateLeadAiScore(lead.id, { score: result.score, reason: result.reasoning });
      await writeAuditLog("lead.score", lead.id);
      scored += 1;
    } catch (err) {
      console.error("[admin/leads] batch score persist failed:", err);
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, scored, failed, remaining: leads.filter((l) => l.aiScore === null).length - unscored.length });
}
