"use client";

import Script from "next/script";

import { brandColors } from "@/lib/site";

const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "agent_8501kzxw287petfv74ank0vr0ec1";

/**
 * Snapshot of this agent's real widget config, fetched 2026-08-14 from
 * https://api.elevenlabs.io/v1/convai/agents/{AGENT_ID}/widget — the exact
 * endpoint the widget itself calls. Verified directly that the dashboard's
 * "Accent" color edit wasn't reaching their backend (styles.accent and the
 * legacy btn_color were still null/#000000 there after saving), so this
 * config is embedded here with ONLY the accent colors changed to brand
 * green, everything else identical to what ElevenLabs was actually serving.
 *
 * Tradeoff: passing `override-config` makes the widget skip its live fetch
 * entirely, so this is now a frozen copy — future edits in the ElevenLabs
 * dashboard (first message, text labels, language presets, etc.) will NOT
 * appear on the site until this snapshot is refetched and updated to match.
 * If ElevenLabs fixes the dashboard save, prefer reverting to a plain
 * agent-id + avatar-orb-color-* setup (see git history) so the widget goes
 * back to reading their dashboard live.
 */
const WIDGET_CONFIG_OVERRIDE = {
  variant: "full",
  placement: "bottom-right",
  avatar: { type: "orb", color_1: "#2792dc", color_2: "#9ce6e6" },
  feedback_mode: "none",
  end_feedback: { type: "rating" },
  bg_color: "#ffffff",
  text_color: "#000000",
  btn_color: brandColors.forest,
  btn_text_color: "#ffffff",
  border_color: "#e1e1e1",
  focus_color: brandColors.forest,
  border_radius: null,
  btn_radius: null,
  show_avatar_when_collapsed: false,
  disable_banner: false,
  override_link: null,
  markdown_link_allowed_hosts: [],
  markdown_link_include_www: true,
  markdown_link_allow_http: true,
  mic_muting_enabled: false,
  transcript_enabled: false,
  text_input_enabled: true,
  conversation_mode_toggle_enabled: false,
  default_expanded: false,
  always_expanded: false,
  dismissible: false,
  show_agent_status: false,
  show_conversation_id: true,
  strip_audio_tags: true,
  syntax_highlight_theme: null,
  styles: {
    accent: brandColors.forest,
    accent_hover: brandColors.emerald,
    accent_active: brandColors.emerald,
  },
  show_resize_button: true,
  language: "en",
  supported_language_overrides: null,
  language_presets: {
    fa: {
      first_message:
        "[گرم و صمیمی] سلام! از تماس شما با دفتر رویا وثوقی سپاسگزاریم. امروز چگونه می‌توانم در رزرو وقت مشاوره یا پاسخ به هر سؤال دیگری که دارید، به شما کمک کنم؟",
      text_contents: null,
      terms_text: null,
      terms_html: null,
      terms_key: null,
    },
  },
  text_only: false,
  supports_text_only: true,
  first_message:
    "[warmly] Hello there! Thank you for calling Roya Vosoughi's office. How can I assist you today ?",
  use_rtc: null,
  file_input_config: {
    enabled: true,
    max_files_in_memory: 10,
    max_files_per_conversation: 10,
  },
};

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
 * `avatar-orb-color-*` and `override-config` (see WIDGET_CONFIG_OVERRIDE
 * above) both patch this agent's config so the widget matches brand green
 * instead of ElevenLabs' default blue orb + black button.
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
        override-config={JSON.stringify(WIDGET_CONFIG_OVERRIDE)}
      />
    </>
  );
}
