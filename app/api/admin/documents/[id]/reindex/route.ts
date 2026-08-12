import { NextResponse } from "next/server";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { reindexDocument } from "@/lib/ai/documents";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("editor");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const { id } = await params;

  try {
    const result = await reindexDocument(id);
    await writeAuditLog("document.reindex", `${id}: ${result.updated} updated, ${result.failed} failed`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/documents] reindex failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }
}
