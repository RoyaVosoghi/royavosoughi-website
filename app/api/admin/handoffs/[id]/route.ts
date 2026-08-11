import { NextResponse } from "next/server";
import { z } from "zod";

import { hasValidAdminSession } from "@/lib/admin/auth";
import { resolveHandoffRequest } from "@/lib/admin/queries";

const PatchSchema = z.object({ resolved: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasValidAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const { id } = await params;

  try {
    await resolveHandoffRequest(id, parsed.data.resolved);
  } catch (err) {
    console.error("[admin/handoffs] update failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
