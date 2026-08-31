import { NextResponse } from "next/server";

import { requireRole } from "@/lib/admin/auth";
import { getContact, getConversationMessages, getConversations, updateContactAiSummary, writeAuditLog } from "@/lib/admin/queries";
import { summarizeContact } from "@/lib/ai/contact-summary";

const MAX_CONVERSATIONS = 5;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("operator");
  if (!gate.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: gate.status });
  }

  const { id } = await params;

  const contact = await getContact(id);
  if (!contact) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const conversations = await getConversations({ search: contact.email }, MAX_CONVERSATIONS);
  const withMessages = await Promise.all(
    conversations
      .filter((c) => c.leadEmail?.toLowerCase() === contact.email.toLowerCase())
      .map(async (c) => ({ channel: c.channel, messages: await getConversationMessages(c.id) })),
  );

  const summary = await summarizeContact(
    contact.name,
    withMessages.map((c) => ({
      channel: c.channel,
      messages: c.messages.slice(-40).map((m) => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content })),
    })),
  );

  if (!summary) {
    return NextResponse.json({ error: "summarization_failed" }, { status: 502 });
  }

  try {
    await updateContactAiSummary(id, summary);
    await writeAuditLog("contact.summary_regenerate", id);
  } catch (err) {
    console.error("[admin/contacts] summary persist failed:", err);
    return NextResponse.json({ error: "storage_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary });
}
