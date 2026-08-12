import { redirect } from "next/navigation";

import { BudgetConfigForm } from "@/components/admin/BudgetConfigForm";
import { EmptyState } from "@/components/admin/EmptyState";
import { SecurityConfigForm } from "@/components/admin/SecurityConfigForm";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { getAdminTranslator } from "@/lib/admin/i18n/server";
import { getBudgetConfig, getMonthlySpend } from "@/lib/ai/budget";
import { getChannelSecret } from "@/lib/ai/channel-secrets";
import { getSecurityConfig } from "@/lib/ai/security-config";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export const metadata = { title: "Security · Admin" };

interface KeyCheck {
  label: string;
  configured: boolean;
  note?: string;
}

export default async function AdminSecurityPage() {
  const t = await getAdminTranslator("security");

  if (!isSupabaseServiceConfigured()) {
    return <EmptyState title={t("notConfiguredTitle")} body={t("notConfiguredBody")} />;
  }

  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.role !== "owner") {
    return <EmptyState title={t("ownerOnlyTitle")} body={t("ownerOnlyBody")} />;
  }

  const [securityConfig, budgetConfig, spend, telegramToken, telegramSecret] = await Promise.all([
    getSecurityConfig(),
    getBudgetConfig(),
    getMonthlySpend(),
    getChannelSecret("telegram", "bot_token"),
    getChannelSecret("telegram", "webhook_secret"),
  ]);

  const keyChecks: KeyCheck[] = [
    { label: t("keyOpenRouter"), configured: Boolean(process.env.OPENROUTER_API_KEY) },
    { label: t("keyGemini"), configured: Boolean(process.env.GEMINI_API_KEY) },
    { label: t("keyOpenAi"), configured: Boolean(process.env.OPENAI_API_KEY) },
    { label: t("keyCohere"), configured: Boolean(process.env.COHERE_API_KEY) },
    { label: t("keyVoyage"), configured: Boolean(process.env.VOYAGE_API_KEY) },
    {
      label: t("keyTelegram"),
      configured: Boolean(telegramToken && telegramSecret),
      note: t("keyTelegramNote"),
    },
    { label: t("keySupabase"), configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { label: t("keyAdminSession"), configured: Boolean(process.env.ADMIN_SESSION_SECRET) },
  ];

  return (
    <div>
      <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
      <h1 className="text-section mt-3 text-forest">{t("title")}</h1>
      <p className="mt-3 text-ink/70">{t("subtitle")}</p>

      <div className="mt-8 flex flex-col gap-8">
        <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
          <h2 className="font-display text-lg font-bold text-forest">{t("apiKeysTitle")}</h2>
          <div className="mt-4 flex flex-col gap-2">
            {keyChecks.map((k) => (
              <div key={k.label} className="flex items-center justify-between gap-4 border-b border-forest/5 py-2 last:border-0">
                <div>
                  <p className="text-sm text-ink/80">{k.label}</p>
                  {k.note ? <p className="text-xs text-ink/40">{k.note}</p> : null}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    k.configured ? "bg-emerald/15 text-emerald" : "bg-saffron/20 text-saffron-deep"
                  }`}
                >
                  {k.configured ? t("keyConfigured") : t("keyMissing")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <SecurityConfigForm initial={securityConfig} />

        <BudgetConfigForm
          monthlyCapUsd={budgetConfig.monthlyCapUsd}
          alertThresholdPct={budgetConfig.alertThresholdPct}
          spentUsd={spend.spentUsd}
        />
      </div>
    </div>
  );
}
