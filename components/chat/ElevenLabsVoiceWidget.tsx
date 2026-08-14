"use client";

import Script from "next/script";

import { brandColors } from "@/lib/site";

const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "agent_8501kzxw287petfv74ank0vr0ec1";

/**
 * ElevenLabs Conversational AI widget — the site's single floating launcher
 * for both text chat and voice calls (it offers a chat toggle and a "Start
 * a call" button in one pill). Renders site-wide from app/[locale]/layout.tsx
 * — the <elevenlabs-convai> custom element manages its own fixed launcher
 * once the embed script registers it, and inherits page direction so it
 * lands at the logical trailing corner (bottom-right in English,
 * bottom-left in Farsi). `variant="compact"` keeps it a small pill rather
 * than the default widget's larger "Need help? Start a call" card, since
 * it's always on screen.
 *
 * `avatar-orb-color-*` swaps the default blue orb for the brand gradient —
 * this is the only visual piece safely overridable from embed attributes.
 * The pill's black background/text ("styles.accent" in ElevenLabs' widget
 * config) is fetched live from the agent's dashboard config and can only be
 * changed there (agent → Widget tab → Appearance) — overriding it from here
 * would require replacing the *entire* widget config via `override-config`,
 * which risks silently resetting other settings (first message, language,
 * avatar, text labels) configured in that dashboard.
 */
export function ElevenLabsVoiceWidget() {
  return (
    <>
      <Script
        src="https://unpkg.com/@elevenlabs/convai-widget-embed"
        strategy="afterInteractive"
        async
      />
      <elevenlabs-convai
        agent-id={AGENT_ID}
        variant="compact"
        avatar-orb-color-1={brandColors.emerald}
        avatar-orb-color-2={brandColors.spring}
      />
    </>
  );
}
