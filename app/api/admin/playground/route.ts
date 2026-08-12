import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { runPlaygroundTurn } from "@/lib/ai/playground";

const BodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  locale: z.enum(["en", "fa"]),
  models: z.array(z.string().trim().min(1).max(100)).min(1).max(2),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(64).max(8192),
  topP: z.number().min(0).max(1),
  promptOverride: z.string().max(8000).optional(),
});

/** Costs real tokens against a real provider, so this stays editor+ (not viewer) even though it never writes to the DB. */
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

  const { models, ...rest } = parsed.data;

  try {
    const results = await Promise.all(models.map((model) => runPlaygroundTurn({ ...rest, model })));
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[admin/playground] run failed:", err);
    return NextResponse.json({ error: "upstream_failed" }, { status: 500 });
  }
}
