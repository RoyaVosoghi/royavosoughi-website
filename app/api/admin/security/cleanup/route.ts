import { NextResponse } from "next/server";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { runRetentionCleanup } from "@/lib/ai/security-config";

export async function POST() {
  const gate = await requireRole("owner");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  try {
    const result = await runRetentionCleanup();
    await writeAuditLog(
      "security.retention_cleanup",
      `${result.conversationsDeleted} conversations, ${result.rateLimitHitsDeleted} rate-limit hits`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/security/cleanup] failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
