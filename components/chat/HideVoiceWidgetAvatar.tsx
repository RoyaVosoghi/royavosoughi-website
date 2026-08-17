"use client";

import { useEffect } from "react";

/**
 * ElevenLabs' widget unconditionally renders an animated "avatar" circle
 * next to the call button in every collapsed layout — traced through their
 * widget-embed bundle, the wrapper components that compose the collapsed
 * launcher (Pee for compact/tiny, Nee for full) always include it with no
 * config field to omit it; `avatar`/`show_avatar_when_collapsed` only change
 * what's drawn *inside* it, never whether it renders. Roya wants just the
 * phone icon (PhoneIconSlot in ElevenLabsVoiceWidget.tsx), so this hides
 * that circle directly.
 *
 * This is safe to hide rather than merely cosmetic residue: with
 * expandable="never" (set in ElevenLabsVoiceWidget's config), the click-to-
 * expand wrapper around it is skipped entirely by their own code, so the
 * avatar has no click handler to lose — confirmed by tracing Lee/Iee in
 * their bundle. Unlike simulating a click to start a call, this never
 * touches call-triggering behavior, only visibility.
 *
 * Selector targets the avatar's inner "orb background" div specifically
 * (div.absolute.inset-0.rounded-full.bg-base-border) rather than anything
 * on the call button itself, and then hides its parent. That exact class
 * combination appears in only one other place in their bundle — an <img>
 * transcript avatar we never render (text_input_enabled: false, no
 * conversation panel) — so it shouldn't collide with the phone button.
 * Fails safe: if ElevenLabs renames these classes in a future release, the
 * selector just stops matching and the avatar reappears — nothing breaks.
 */
export function HideVoiceWidgetAvatar() {
  useEffect(() => {
    const host = document.querySelector("elevenlabs-convai");
    if (!host) return;

    function hide(root: ShadowRoot) {
      const marker = root.querySelector("div.absolute.inset-0.rounded-full.bg-base-border");
      const avatarEl = marker?.parentElement as HTMLElement | null;
      if (avatarEl && avatarEl.style.display !== "none") avatarEl.style.display = "none";
    }

    function watch(shadow: ShadowRoot) {
      hide(shadow);
      const observer = new MutationObserver(() => hide(shadow));
      observer.observe(shadow, { childList: true, subtree: true });
      return observer;
    }

    if (host.shadowRoot) {
      const observer = watch(host.shadowRoot);
      return () => observer.disconnect();
    }

    // The embed script attaches the shadow root asynchronously after it
    // loads, so it isn't necessarily present on first mount — poll briefly
    // until it shows up.
    let observer: MutationObserver | null = null;
    const interval = setInterval(() => {
      if (host.shadowRoot) {
        clearInterval(interval);
        observer = watch(host.shadowRoot);
      }
    }, 200);

    return () => {
      clearInterval(interval);
      observer?.disconnect();
    };
  }, []);

  return null;
}
