import Script from "next/script";

import { HideVoiceWidgetAvatar } from "@/components/chat/HideVoiceWidgetAvatar";
import { brandColors } from "@/lib/site";

const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "agent_8501kzxw287petfv74ank0vr0ec1";

/**
 * Roya's exact reference mark (white disc, forest ring, forest phone glyph),
 * projected into the widget's shadow DOM via its `icon-phone` named slot —
 * confirmed by dumping the live widget's shadowRoot.innerHTML, which exposes
 * `<slot name="icon-phone">` around the default glyph. Unlike `avatar` (a
 * config field that never reaches this button, see below), slots are a
 * standard Web Components mechanism: any light-DOM child of
 * <elevenlabs-convai> with a matching `slot` attribute replaces that
 * fallback content directly, so this is a supported customization path, not
 * a DOM hack. Sized to exactly cover the real button (36x36px at
 * variant="tiny", verified via getBoundingClientRect against the live
 * widget) — the -9px margin cancels out the slot wrapper's own centering so
 * the icon fills the whole circular button rather than sitting small inside
 * it.
 */
function PhoneIconSlot() {
  return (
    <svg
      slot="icon-phone"
      viewBox="0 0 36 36"
      width={36}
      height={36}
      style={{ margin: "-9px", flexShrink: 0 }}
    >
      <circle cx="18" cy="18" r="18" fill="#ffffff" />
      <circle cx="18" cy="18" r="16.5" fill="none" stroke={brandColors.forest} strokeWidth={1.6} />
      <g transform="translate(9,9) scale(0.75)">
        <path
          d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
          fill={brandColors.forest}
        />
      </g>
    </svg>
  );
}

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
 * ElevenLabs Conversational AI widget — the site's voice-call launcher.
 * Renders site-wide from app/[locale]/layout.tsx
 * — the <elevenlabs-convai> custom element manages its own fixed launcher
 * once the embed script registers it, and inherits page direction so it
 * lands at the logical trailing corner (bottom-right in English,
 * bottom-left in Farsi). `variant="tiny"` renders an icon-only launcher (no
 * "Start a call" text); the icon itself is PhoneIconSlot above, projected in
 * via the `icon-phone` slot rather than any override-config field — that
 * button's glyph is hardcoded inside ElevenLabs' widget bundle
 * (`icon: "phone"`) with no *config* hook to replace it, confirmed by
 * reading their widget-embed source. `avatar`/`show_avatar_when_collapsed`
 * overrides don't reach this button at all — that's a separate animated
 * circle ElevenLabs renders next to it unconditionally in every collapsed
 * layout; Roya wants only the phone icon, so <HideVoiceWidgetAvatar />
 * below removes that circle client-side (see its own comment for why that's
 * safe to do).
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
    avatar: { type: "orb", color_1: brandColors.emerald, color_2: brandColors.spring },
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
      // All three pinned to forest, not just the base accent — this is the
      // button chrome sitting directly behind PhoneIconSlot's baked-in forest
      // ring, and an emerald hover/active state would show as a visible
      // color mismatch right at that ring's edge.
      accent: brandColors.forest,
      accent_hover: brandColors.forest,
      accent_active: brandColors.forest,
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
        variant="tiny"
        override-config={JSON.stringify(config)}
      >
        <PhoneIconSlot />
      </elevenlabs-convai>
      <HideVoiceWidgetAvatar />
    </>
  );
}
