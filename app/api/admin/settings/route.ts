import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/lib/admin/auth";
import { updateBotSettings } from "@/lib/ai/settings";

const SettingsUpdateSchema = z.object({
  systemPromptEn: z.string().trim().max(8000).optional(),
  systemPromptFa: z.string().trim().max(8000).optional(),
  chunkTargetChars: z.number().int().min(100).max(4000).optional(),
  chunkMaxChars: z.number().int().min(100).max(6000).optional(),
  chunkOverlapChars: z.number().int().min(0).max(1000).optional(),
  retrievalTopK: z.number().int().min(1).max(20).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  summarizeAfterMessages: z.number().int().min(4).max(200).optional(),
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

  const parsed = SettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // An empty textarea means "go back to the built-in default", i.e. NULL —
  // not "override with an empty string".
  const update: Parameters<typeof updateBotSettings>[0] = { ...parsed.data };
  if (parsed.data.systemPromptEn !== undefined) {
    update.systemPromptEn = parsed.data.systemPromptEn || null;
  }
  if (parsed.data.systemPromptFa !== undefined) {
    update.systemPromptFa = parsed.data.systemPromptFa || null;
  }

  try {
    await updateBotSettings(update);
  } catch (err) {
    console.error("[admin/settings] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
