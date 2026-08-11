import { BroadcastForm } from "@/components/admin/BroadcastForm";
import { EmptyState } from "@/components/admin/EmptyState";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Broadcast · Admin" };

export default function AdminBroadcastPage() {
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to send broadcasts here."
      />
    );
  }

  return (
    <div>
      <p className="label-eyebrow text-emerald">Telegram</p>
      <h1 className="text-section mt-3 text-forest">Broadcast</h1>
      <p className="mt-3 text-ink/70">
        Send one message to every Telegram user who has ever messaged the bot. Preview the
        recipient count before sending — there's no undo once it's sent.
      </p>

      <div className="mt-8">
        <BroadcastForm />
      </div>
    </div>
  );
}
