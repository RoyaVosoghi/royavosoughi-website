import Script from "next/script";

import { HideVoiceWidgetAvatar } from "@/components/chat/HideVoiceWidgetAvatar";
import { VoiceWidgetChromeOverrides } from "@/components/chat/VoiceWidgetChromeOverrides";
import { brandColors } from "@/lib/site";

const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "agent_8501kzxw287petfv74ank0vr0ec1";

/**
 * A white phone glyph, projected into the widget's shadow DOM via its
 * `icon-phone` named slot — confirmed by dumping the live widget's
 * shadowRoot.innerHTML, which exposes `<slot name="icon-phone">` around the
 * default glyph. Unlike `avatar` (a config field that never reaches this
 * button, see below), slots are a standard Web Components mechanism: any
 * light-DOM child of <elevenlabs-convai> with a matching `slot` attribute
 * replaces that fallback content directly, so this is a supported
 * customization path, not a DOM hack.
 *
 * Deliberately draws only the glyph, not a background disc — the real
 * button underneath is already pinned solid forest (config.styles.accent
 * below), so this reads as a white icon on a solid-forest circle, matching
 * our own text-chat bubble's launcher (lib/widget/entry.ts's CHAT_ICON on
 * `.rv-launcher`) rather than the previous white-disc/forest-ring mark.
 *
 * Canvas is 36x36 (the button's original, unresized dimensions at
 * variant="tiny", verified via getBoundingClientRect against the live
 * widget) — the -9px margin cancels out the slot wrapper's own centering.
 * The glyph itself is scaled down and centered within that canvas (16px)
 * rather than filling it.
 *
 * <ResizeVoiceWidgetButton/> below grows the actual button to 60px to match
 * the text-chat launcher, but this SVG deliberately keeps its original
 * 36x36 sizing rather than growing with it: the slot wrapper centers
 * whatever box this produces via flex, independently of the button's own
 * size, so the glyph's pixel size and position stay exactly as they were —
 * only the forest circle around it gets bigger.
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
      <g
        transform="translate(10,10) scale(0.667)"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
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
 * bottom-left in Farsi).
 *
 * `variant="full"` — deliberately, even though it's the "biggest" preset.
 * "tiny"/"compact" render only the bare button with nothing else: pressing
 * it just swaps the icon in place with no visible window, which read as
 * completely broken ("I press the button and see nothing"). "full" is the
 * only variant that shows an actual call window (status + a proper "End"
 * button) once a call starts. Its side effects — a permanent "Need help?"
 * prompt card, and visible "Start a call"/"End" text inside the button
 * itself — are clawed back client-side by <VoiceWidgetChromeOverrides />
 * below (see its own comment for the exact mechanism), so the idle state
 * still reads as a single icon-only button matching the text-chat bubble,
 * and the prompt card/window only appear once a call is actually live.
 *
 * The icon itself is PhoneIconSlot above, projected in via the `icon-phone`
 * slot rather than any override-config field — that button's glyph is
 * hardcoded inside ElevenLabs' widget bundle (`icon: "phone"`) with no
 * *config* hook to replace it, confirmed by reading their widget-embed
 * source. `avatar`/`show_avatar_when_collapsed` overrides don't reach this
 * button at all — that's a separate animated circle ElevenLabs renders next
 * to it unconditionally in every collapsed layout; Roya wants only the phone
 * icon, so <HideVoiceWidgetAvatar /> below removes that circle client-side
 * (see its own comment for why that's safe to do).
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
    // The ElevenLabs dashboard has this agent's widget set to
    // expandable: "never" — irrelevant to whether the call window shows
    // (that's purely variant="full" below), but "never" is documented
    // elsewhere in their widget to skip click-to-expand behavior entirely,
    // so it's overridden here too rather than left as a landmine.
    expandable: "always",
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
      // The collapsed button isn't the only circle here — ElevenLabs wraps
      // it in its own padded "sheet" container (bg-base, ~8px bigger on
      // every side) that defaults to white, which is what read as a white
      // ring around the forest button. `base`/`base_hover`/`base_active`
      // are that sheet's background, pinned to forest for the same reason
      // as accent below — so the ring disappears into the button instead of
      // framing it.
      base: brandColors.forest,
      base_hover: brandColors.forest,
      base_active: brandColors.forest,
      // This sheet is reused as the button itself once a call is live (it
      // switches to an "end call" glyph rendered in base_primary, not
      // accent_primary) — bumped from emerald to offwhite so that glyph
      // stays legible against the now-forest sheet instead of a forest icon
      // on forest background.
      base_primary: brandColors.offwhite,
      // All three pinned to forest, not just the base accent — this is the
      // solid-forest button chrome that PhoneIconSlot's white glyph sits on
      // top of, and an emerald hover/active state would show as a visible
      // color flash right behind the icon.
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
        variant="full"
        override-config={JSON.stringify(config)}
      >
        <PhoneIconSlot />
      </elevenlabs-convai>
      <HideVoiceWidgetAvatar />
      <VoiceWidgetChromeOverrides />
    </>
  );
}
