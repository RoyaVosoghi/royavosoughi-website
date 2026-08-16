import Script from "next/script";

import { brandColors } from "@/lib/site";

const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "agent_8501kzxw287petfv74ank0vr0ec1";

/**
 * Replaces the widget's default launcher glyph with a plain phone icon on a
 * forest-green disc, matching the site's own chat bubble (lib/widget/entry.ts).
 * ElevenLabs' override-config has no dedicated "collapsed icon" field — the
 * same `avatar` object also renders inside an active call — so the circle
 * fill is baked into the SVG itself rather than relying on btn_color to show
 * through. Confirmed against the widget-embed bundle (avatar type "url"
 * reads `custom_url`; there's no documented alternative).
 */
const PHONE_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${brandColors.forest}"/><path d="M42 36.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 24.11 22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L28.09 29.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 42 36.92z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PHONE_AVATAR_URL = `data:image/svg+xml,${encodeURIComponent(PHONE_AVATAR_SVG)}`;

/**
 * Fallback only — used if the live fetch in getWidgetConfig() below fails
 * (network blip, ElevenLabs API down at build time, etc.). Last known-good
 * snapshot from 2026-08-14. Not meant to be kept in sync by hand; the live
 * fetch is the source of truth.
 */
const FALLBACK_WIDGET_CONFIG: Record<string, unknown> = {
  variant: "full",
  placement: "bottom-right",
  expandable: "never",
  feedback_mode: "none",
  end_feedback: { type: "rating" },
  bg_color: "#ffffff",
  text_color: "#000000",
  btn_text_color: "#ffffff",
  border_color: "#e1e1e1",
  border_radius: null,
  btn_radius: null,
  show_avatar_when_collapsed: false,
  disable_banner: false,
  markdown_link_include_www: true,
  markdown_link_allow_http: true,
  text_input_enabled: true,
  default_expanded: false,
  always_expanded: false,
  dismissible: false,
  show_conversation_id: true,
  strip_audio_tags: true,
  show_resize_button: true,
  language: "en",
  language_presets: {
    fa: {
      first_message:
        "[گرم و صمیمی] سلام! از تماس شما با دفتر رویا وثوقی سپاسگزاریم. امروز چگونه می‌توانم در رزرو وقت مشاوره یا پاسخ به هر سؤال دیگری که دارید، به شما کمک کنم؟",
    },
  },
  text_only: false,
  supports_text_only: true,
  first_message:
    "[warmly] Hello there! Thank you for calling Roya Vosoughi's office. How can I assist you today ?",
  file_input_config: {
    enabled: true,
    max_files_in_memory: 10,
    max_files_per_conversation: 10,
  },
};

/**
 * Fetches this agent's real widget config straight from ElevenLabs at
 * render time — the same public endpoint the widget itself calls — so any
 * edit made in the ElevenLabs dashboard (first message, text labels,
 * language presets, agent behavior, etc.) reaches the site within the
 * revalidate window below, with no manual re-sync step.
 *
 * `next: { revalidate }` caches this at the Next.js data-cache layer, so
 * it's not fetched on every request.
 */
async function getWidgetConfig(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}/widget`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) throw new Error(`ElevenLabs widget config fetch failed: ${res.status}`);
    const data = (await res.json()) as { widget_config?: Record<string, unknown> };
    if (!data.widget_config) throw new Error("ElevenLabs widget config response had no widget_config");
    return data.widget_config;
  } catch (err) {
    console.error("[ElevenLabsVoiceWidget] falling back to static widget config:", err);
    return FALLBACK_WIDGET_CONFIG;
  }
}

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
 * The live config is merged with a forced brand-green override for ONLY the
 * button/accent colors — ElevenLabs' dashboard "Accent" color edit doesn't
 * reach their backend (verified directly: btn_color/focus_color/styles.accent
 * were still null/#000000 there after saving), so those specific fields are
 * pinned here. Everything else (first message, text labels, language
 * presets, agent behavior) comes straight from the live fetch above.
 */
export async function ElevenLabsVoiceWidget() {
  const liveConfig = await getWidgetConfig();
  const styles = (liveConfig.styles as Record<string, unknown>) ?? {};

  const config = {
    ...liveConfig,
    avatar: { type: "url", custom_url: PHONE_AVATAR_URL },
    show_avatar_when_collapsed: true,
    btn_color: brandColors.forest,
    focus_color: brandColors.forest,
    // Voice-only: text chat is handled by our own widget (lib/widget/entry.ts)
    // now, which we fully control — greeting-on-open, idle-close, and a
    // satisfaction rating all need real implementation ElevenLabs' text/chat
    // mode doesn't support yet (confirmed: no proactive greeting before the
    // visitor's first message, and max_duration_seconds_after_last_agent_message
    // doesn't enforce in text sessions). Keeping both text entry points on
    // the same page would just be confusing.
    text_input_enabled: false,
    styles: {
      ...styles,
      base_primary: brandColors.emerald,
      accent: brandColors.forest,
      accent_hover: brandColors.emerald,
      accent_active: brandColors.emerald,
    },
  };

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
        override-config={JSON.stringify(config)}
      />
    </>
  );
}
