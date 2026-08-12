import { ChannelGreetingsForm } from "@/components/admin/ChannelGreetingsForm";
import { EmbeddingConfigForm } from "@/components/admin/EmbeddingConfigForm";
import { EmptyState } from "@/components/admin/EmptyState";
import { ModelConfigForm } from "@/components/admin/ModelConfigForm";
import { PersonaSettingsForm } from "@/components/admin/PersonaSettingsForm";
import { WidgetConfigForm } from "@/components/admin/WidgetConfigForm";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getAllChannelGreetings } from "@/lib/ai/channel-greetings";
import { getEmbeddingConfig } from "@/lib/ai/embedding-config";
import { getAllModelConfigs } from "@/lib/ai/model-config";
import { DEFAULT_SYSTEM_PROMPT_EN, DEFAULT_SYSTEM_PROMPT_FA } from "@/lib/ai/prompt";
import { getActivePromptContent, getPromptVersionHistory } from "@/lib/ai/prompt-versions";
import { getWidgetConfig } from "@/lib/ai/widget-config";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  const t = await getAdminTranslator("settings");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const [activeEn, activeFa, history, modelConfigs, embeddingConfig, widgetConfig, channelGreetings] = await Promise.all([
    getActivePromptContent("en"),
    getActivePromptContent("fa"),
    getPromptVersionHistory(),
    getAllModelConfigs(),
    getEmbeddingConfig(),
    getWidgetConfig(),
    getAllChannelGreetings(),
  ]);

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("description")}</p>

      <div className="mt-8 flex flex-col gap-8">
        <PersonaSettingsForm
          initialEn={activeEn ?? DEFAULT_SYSTEM_PROMPT_EN}
          initialFa={activeFa ?? DEFAULT_SYSTEM_PROMPT_FA}
          historyCountEn={history.filter((v) => v.persona === "en").length}
          historyCountFa={history.filter((v) => v.persona === "fa").length}
        />

        <ModelConfigForm initial={modelConfigs} />

        <EmbeddingConfigForm initial={embeddingConfig} />

        <ChannelGreetingsForm initial={channelGreetings} />

        <WidgetConfigForm
          initial={{
            primaryColor: widgetConfig.primaryColor,
            position: widgetConfig.position,
            welcomeMessageEn: widgetConfig.welcomeMessageEn ?? "",
            welcomeMessageFa: widgetConfig.welcomeMessageFa ?? "",
            allowedDomains: widgetConfig.allowedDomains,
          }}
        />
      </div>
    </div>
  );
}
