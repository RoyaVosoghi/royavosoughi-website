import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { updateWidgetConfig } from "@/lib/ai/widget-config";

const BodySchema = z.object({
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #0f7b4f"),
  position: z.enum(["bottom-end", "bottom-start"]),
  welcomeMessageEn: z.string().trim().max(500).optional(),
  welcomeMessageFa: z.string().trim().max(500).optional(),
  allowedDomains: z.array(z.string().trim().min(1).max(255)),
});

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const update = {
    ...parsed.data,
    welcomeMessageEn: parsed.data.welcomeMessageEn || null,
    welcomeMessageFa: parsed.data.welcomeMessageFa || null,
  };

  try {
    await updateWidgetConfig(update);
    await writeAuditLog("widget_config.update");
  } catch (err) {
    console.error("[admin/widget-config] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
