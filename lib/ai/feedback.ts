import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

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
}
