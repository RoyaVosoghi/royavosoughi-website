import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { getModelCatalogEntry } from "@/lib/ai/model-catalog";
import { updateModelConfig } from "@/lib/ai/model-config";

const WeekdayScheduleSchema = z.record(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.string().trim().min(1).max(100));

const BodySchema = z.object({
  channel: z.enum(["web", "telegram", "widget"]),
  activeModel: z.string().trim().min(1).max(100),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(64).max(8192),
  topP: z.number().min(0).max(1),
  fallbackModel: z.string().trim().min(1).max(100).nullable().optional(),
  schedule: WeekdayScheduleSchema.nullable().optional(),
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

  const { channel, ...update } = parsed.data;

  // provider is never trusted from the client — it's derived here from the
  // catalog entry the active model actually belongs to. This is what keeps
  // (provider, activeModel) from ever landing in a mismatched state (e.g.
  // provider 'gemini' with an OpenRouter-shaped slug, which brain.ts would
  // send to the wrong client and 400 on). A fallback/scheduled model that
  // isn't in the catalog, or belongs to a different provider than the
  // active model, is rejected outright rather than silently saved broken —
  // primary and fallback must share one client for brain.ts's retry logic
  // to make sense.
  const activeEntry = getModelCatalogEntry(update.activeModel);
  if (!activeEntry) {
    return NextResponse.json({ error: "unknown_model", model: update.activeModel }, { status: 400 });
  }

  if (update.fallbackModel) {
    const fallbackEntry = getModelCatalogEntry(update.fallbackModel);
    if (!fallbackEntry) {
      return NextResponse.json({ error: "unknown_model", model: update.fallbackModel }, { status: 400 });
    }
    if (fallbackEntry.provider !== activeEntry.provider) {
      return NextResponse.json(
        { error: "provider_mismatch", detail: "fallbackModel must use the same provider as activeModel" },
        { status: 400 },
      );
    }
  }

  if (update.schedule) {
    for (const [day, slug] of Object.entries(update.schedule)) {
      const entry = getModelCatalogEntry(slug);
      if (!entry) {
        return NextResponse.json({ error: "unknown_model", model: slug, day }, { status: 400 });
      }
      if (entry.provider !== activeEntry.provider) {
        return NextResponse.json(
          { error: "provider_mismatch", detail: `schedule.${day} must use the same provider as activeModel` },
          { status: 400 },
        );
      }
    }
  }

  try {
    await updateModelConfig(channel, { ...update, provider: activeEntry.provider });
    await writeAuditLog("model_config.update", channel);
  } catch (err) {
    console.error("[admin/model-config] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
