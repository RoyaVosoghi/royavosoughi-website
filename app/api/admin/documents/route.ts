import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/queries";
import { ingestDocx, ingestPdf, ingestUrl } from "@/lib/ai/ingest-sources";
import { ingestSource } from "@/lib/ai/ingest";

const MetaSchema = z.object({
  kind: z.enum(["pdf", "docx", "text", "url"]),
  sourceKey: z.string().trim().min(1).max(200),
  locale: z.enum(["en", "fa"]),
  tags: z.string().trim().max(300).optional(),
});

const MAX_FILE_BYTES = 15 * 1024 * 1024;

function parseTags(tags: string | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const gate = await requireRole("editor");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const parsed = MetaSchema.safeParse({
    kind: formData.get("kind"),
    sourceKey: formData.get("sourceKey"),
    locale: formData.get("locale"),
    tags: formData.get("tags") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  const { kind, sourceKey, locale } = parsed.data;
  const tags = parseTags(parsed.data.tags);

  try {
    let result;
    if (kind === "pdf" || kind === "docx") {
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "missing_file" }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "file_too_large" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      result = kind === "pdf" ? await ingestPdf({ sourceKey, locale, tags, buffer }) : await ingestDocx({ sourceKey, locale, tags, buffer });
    } else if (kind === "url") {
      const url = String(formData.get("url") ?? "").trim();
      if (!url) return NextResponse.json({ error: "missing_url" }, { status: 400 });
      result = await ingestUrl({ sourceKey, locale, tags, url });
    } else {
      const text = String(formData.get("text") ?? "").trim();
      if (!text) return NextResponse.json({ error: "missing_text" }, { status: 400 });
      result = await ingestSource({
        sourceType: "curated_doc",
        sourceKey,
        locale,
        tags,
        sections: [{ body: text }],
      });
    }

    await writeAuditLog("document.create", `${sourceKey} [${locale}]`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/documents] ingest failed:", err);
    return NextResponse.json({ error: "ingest_failed", message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
