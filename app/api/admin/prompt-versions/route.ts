import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { clearActivePromptVersion, createPromptVersion } from "@/lib/ai/prompt-versions";

const BodySchema = z.object({
  locale: z.enum(["en", "fa"]),
  content: z.string().trim().max(24000),
  /** Empty content means "revert to the built-in default" — deactivates whatever's active without creating a new version. */
  reset: z.boolean().optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("editor");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  const { locale, content, reset } = parsed.data;

  try {
    if (reset || !content) {
      await clearActivePromptVersion(locale);
      await writeAuditLog("prompt.reset", locale);
    } else {
      await createPromptVersion(locale, content, gate.admin.id);
      await writeAuditLog("prompt.create", locale);
    }
  } catch (err) {
    console.error("[admin/prompt-versions] save failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
