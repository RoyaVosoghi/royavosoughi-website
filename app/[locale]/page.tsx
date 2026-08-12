import { setRequestLocale } from "next-intl/server";

import { ChatBubble } from "@/components/chat/ChatBubble";
import { AboutTeaser } from "@/components/sections/AboutTeaser";
import { Contact } from "@/components/sections/Contact";
import { Hero } from "@/components/sections/Hero";
import { Projects } from "@/components/sections/Projects";
import { Proof } from "@/components/sections/Proof";
import { Services } from "@/components/sections/Services";
import { isBrainConfigured } from "@/lib/ai/brain";
import { getChannelGreeting } from "@/lib/ai/channel-greetings";
import type { Locale } from "@/lib/ai/types";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const chatConfigured = isBrainConfigured();
  const greeting = await getChannelGreeting("web", locale as Locale);

  return (
    <>
      <Hero />
      <Proof />
      <Services />
      <Projects />
      <AboutTeaser />
      <Contact />
      <ChatBubble
        configured={chatConfigured}
        locale={locale as Locale}
        welcomeOverride={greeting.welcomeMessage}
        startersOverride={greeting.quickReplies}
      />
    </>
  );
}
