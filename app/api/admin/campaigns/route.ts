import { NextResponse } from "next/server";
import { z } from "zod";

import { audit, gate, jsonError, parseBody } from "@/lib/admin/api";
import { createCampaign } from "@/lib/admin/crm-docs";
import { SEGMENT_KEYS, buildSegment } from "@/lib/crm/segments";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  segmentKey: z.enum(SEGMENT_KEYS),
  goal: z.string().trim().min(5).max(1000),
});

/** Freezes the segment's current members into campaign_emails (status pending) — the list doesn't shift while drafts are reviewed. */
export async function POST(request: Request) {
  const auth = await gate("operator");
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, BodySchema);
  if ("response" in body) return body.response;

  try {
    const recipients = await buildSegment(body.data.segmentKey);
    if (!recipients.length) return jsonError("empty_segment", 400);
    const id = await createCampaign({ ...body.data, recipients }, auth.admin.id);
    await audit("campaign.create", `${body.data.name} (${recipients.length})`);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[admin/campaigns] create failed:", err);
    return jsonError("storage_failed", 500);
  }
}
