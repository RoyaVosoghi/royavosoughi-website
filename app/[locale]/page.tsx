import { setRequestLocale } from "next-intl/server";

import { ChatBubble } from "@/components/chat/ChatBubble";
import { AboutTeaser } from "@/components/sections/AboutTeaser";
import { Contact } from "@/components/sections/Contact";
import { Hero } from "@/components/sections/Hero";
import { Projects } from "@/components/sections/Projects";
import { Proof } from "@/components/sections/Proof";
import { Services } from "@/components/sections/Services";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import type { Locale } from "@/lib/ai/types";
import { isSupabaseServiceConfigured } from "@/lib/supabase-admin";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const chatConfigured = isGeminiConfigured() && isSupabaseServiceConfigured();

  return (
    <>
      <Hero />
      <Proof />
      <Services />
      <Projects />
      <AboutTeaser />
      <Contact />
      <ChatBubble configured={chatConfigured} locale={locale as Locale} />
    </>
  );
}
