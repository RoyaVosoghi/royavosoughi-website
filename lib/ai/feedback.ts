import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** A 👎 auto-flags the conversation for review in the admin inbox — this is the "flagged conversations" queue's main feeder, alongside manual flagging. */
export async function submitFeedback(
  messageId: string,
  rating: 1 | -1,
  comment?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase.from("feedback").insert({
    message_id: messageId,
    rating,
    comment: comment || null,
  });
  if (error) throw error;

  if (rating === -1) {
    const { data: message } = await supabase.from("messages").select("conversation_id").eq("id", messageId).maybeSingle();
    if (message?.conversation_id) {
      await supabase.from("conversations").update({ flagged: true }).eq("id", message.conversation_id);
    }
  }
}
