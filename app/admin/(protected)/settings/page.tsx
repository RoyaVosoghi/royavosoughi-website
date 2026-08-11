import { EmbeddingConfigForm } from "@/components/admin/EmbeddingConfigForm";
import { EmptyState } from "@/components/admin/EmptyState";
import { ModelConfigForm } from "@/components/admin/ModelConfigForm";
import { PersonaSettingsForm } from "@/components/admin/PersonaSettingsForm";
import { getEmbeddingConfig } from "@/lib/ai/embedding-config";
import { getAllModelConfigs } from "@/lib/ai/model-config";
import { DEFAULT_SYSTEM_PROMPT_EN, DEFAULT_SYSTEM_PROMPT_FA } from "@/lib/ai/prompt";
import { getActivePromptContent, getPromptVersionHistory } from "@/lib/ai/prompt-versions";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

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

  const [activeEn, activeFa, history, modelConfigs, embeddingConfig] = await Promise.all([
    getActivePromptContent("en"),
    getActivePromptContent("fa"),
    getPromptVersionHistory(),
    getAllModelConfigs(),
    getEmbeddingConfig(),
  ]);

  return (
    <div>
      <p className="label-eyebrow text-emerald">The brain</p>
      <h1 className="text-section mt-3 text-forest">Settings</h1>
      <p className="mt-3 text-ink/70">
        Tune the chatbot's persona, models, and retrieval behavior without a redeploy — every
        channel (web, widget, Telegram) reads from here.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        <PersonaSettingsForm
          initialEn={activeEn ?? DEFAULT_SYSTEM_PROMPT_EN}
          initialFa={activeFa ?? DEFAULT_SYSTEM_PROMPT_FA}
          historyCountEn={history.filter((v) => v.persona === "en").length}
          historyCountFa={history.filter((v) => v.persona === "fa").length}
        />

        <ModelConfigForm initial={modelConfigs} />

        <EmbeddingConfigForm initial={embeddingConfig} />
      </div>
    </div>
  );
}
