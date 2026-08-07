import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ChatWidget } from "@/components/chat/ChatWidget";
import { Section } from "@/components/ui/Section";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import type { Locale } from "@/lib/ai/types";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chatPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `/${locale}/chat`,
      languages: { en: "/en/chat", fa: "/fa/chat", "x-default": "/en/chat" },
    },
  };
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("chatPage");

  const configured = isGeminiConfigured() && isSupabaseServiceConfigured();

  return (
    <Section tone="light" className="pt-14 md:pt-20">
      <div className="mx-auto max-w-3xl">
        <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
        <h1 className="text-section mt-4 text-forest">{t("title")}</h1>
        <p className="mt-6 text-lg text-ink/80">{t("lead")}</p>

        <div className="mt-10">
          <ChatWidget configured={configured} locale={locale as Locale} />
        </div>
      </div>
    </Section>
  );
}
