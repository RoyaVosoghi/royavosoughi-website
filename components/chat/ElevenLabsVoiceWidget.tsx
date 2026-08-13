"use client";

import Script from "next/script";

const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "agent_8501kzxw287petfv74ank0vr0ec1";

/**
 * ElevenLabs Conversational AI (voice) widget. Renders site-wide from
 * app/[locale]/layout.tsx — the <elevenlabs-convai> custom element manages
 * its own fixed launcher once the embed script registers it, and inherits
 * page direction so it lands at the logical *trailing* corner (bottom-right
 * in English, bottom-left in Farsi). `variant="compact"` keeps it a small
 * orb rather than the default widget's larger "Need help? Start a call"
 * card, since it's always on screen. ChatBubble (the text chat) deliberately
 * uses the opposite logical corner — see its comment.
 */
export function ElevenLabsVoiceWidget() {
  return (
    <>
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        strategy="afterInteractive"
        async
      />
      <elevenlabs-convai agent-id={AGENT_ID} variant="compact" />
    </>
  );
}
