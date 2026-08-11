import { SettingsForm } from "@/components/admin/SettingsForm";
import { DEFAULT_SYSTEM_PROMPT_EN, DEFAULT_SYSTEM_PROMPT_FA } from "@/lib/ai/prompt";
import { getBotSettings } from "@/lib/ai/settings";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";
import { EmptyState } from "@/components/admin/EmptyState";

export const metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  if (!isSupabaseServiceConfigured()) {
    return (
      <EmptyState
        title="Supabase isn't configured"
        body="Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to edit bot settings here."
      />
    );
  }

  const settings = await getBotSettings();

  return (
    <div>
      <p className="label-eyebrow text-emerald">The brain</p>
      <h1 className="text-section mt-3 text-forest">Settings</h1>
      <p className="mt-3 text-ink/70">
        Tune the chatbot's persona and RAG behavior without a redeploy — every channel (web,
        widget, Telegram) reads from here.
      </p>

      <SettingsForm
        initial={{
          systemPromptEn: settings.systemPromptEn ?? DEFAULT_SYSTEM_PROMPT_EN,
          systemPromptFa: settings.systemPromptFa ?? DEFAULT_SYSTEM_PROMPT_FA,
          chunkTargetChars: settings.chunkTargetChars,
          chunkMaxChars: settings.chunkMaxChars,
          chunkOverlapChars: settings.chunkOverlapChars,
          retrievalTopK: settings.retrievalTopK,
          similarityThreshold: settings.similarityThreshold,
          summarizeAfterMessages: settings.summarizeAfterMessages,
        }}
      />
    </div>
  );
}
