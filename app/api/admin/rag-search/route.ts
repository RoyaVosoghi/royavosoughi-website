import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { retrieveContext } from "@/lib/ai/retrieval";

const BodySchema = z.object({
  query: z.string().trim().min(1).max(2000),
  locale: z.enum(["en", "fa"]),
  k: z.number().int().min(1).max(20).optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("viewer");
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
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const results = await retrieveContext(parsed.data.query, parsed.data.locale, {
    k: parsed.data.k,
    similarityThreshold: 0, // the test box should show what WOULD match at any threshold, not just what clears the live one
  });

  return NextResponse.json({ ok: true, results });
}
