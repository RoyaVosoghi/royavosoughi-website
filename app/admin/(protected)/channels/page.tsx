import { EmptyState } from "@/components/admin/EmptyState";
import { TelegramChannelForm } from "@/components/admin/TelegramChannelForm";
import { WidgetEmbedCode } from "@/components/admin/WidgetEmbedCode";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getChannelSecret, maskSecret } from "@/lib/ai/channel-secrets";
import { getWidgetConfig } from "@/lib/ai/widget-config";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Channels · Admin" };

export default async function AdminChannelsPage() {
  const t = await getAdminTranslator("channels");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const [botToken, webhookSecret, adminChatId, widgetConfig] = await Promise.all([
    getChannelSecret("telegram", "bot_token"),
    getChannelSecret("telegram", "webhook_secret"),
    getChannelSecret("telegram", "admin_chat_id"),
    getWidgetConfig(),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://royavosoughi.com";

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8 flex flex-col gap-8">
        <TelegramChannelForm
          maskedBotToken={botToken ? maskSecret(botToken) : null}
          maskedWebhookSecret={webhookSecret ? maskSecret(webhookSecret) : null}
          currentAdminChatId={adminChatId}
          siteUrl={siteUrl}
        />
        <WidgetEmbedCode siteUrl={siteUrl} allowedDomains={widgetConfig.allowedDomains} />
      </div>
    </div>
  );
}
