"use client";

import { useEffect } from "react";

/**
 * Chrome overrides for the ElevenLabs call button, applied inside the
 * widget's shadow DOM.
 *
 * Why `variant="full"` at all, given all this extra work: it's the only
 * variant that renders an actual call window (status text + a proper "End"
 * button) once a call starts — "tiny" and "compact" just swap the button's
 * icon/label in place with nothing else visible, which is what originally
 * looked broken ("I press the button and see nothing"). The cost of getting
 * that window is that "full" also renders a persistent "Need help? / Start a
 * call" prompt card next to the button at all times, and shows visible
 * "Start a call" / "End" text inside the button itself — neither of which
 * matches the icon-only launcher deliberately built to match the text-chat
 * bubble. This component claws back that look, in two parts:
 *
 * 1. A static `<style>` tag, sized/icon-only via `:has()` selectors that
 *    target the button by structure rather than by variant-specific wrapper
 *    classes or by its visible text (which changes with the widget's
 *    language — matching on "Start a call" would silently stop working on
 *    the Farsi pages):
 *    - Button forced to a fixed 60px circle (matching the text-chat bubble),
 *      selected via `:has(> slot[name="icon-*"])` — those two slot names are
 *      unique to this call button (icon-phone from our own PhoneIconSlot,
 *      icon-phone-off from ElevenLabs' built-in end-call icon), so this
 *      can't collide with any other button ElevenLabs might render.
 *    - That button's inner text-label wrapper (a `div` sibling of the icon
 *      slot) is hidden — icon only, always. The button's `aria-label` still
 *      carries the real text for screen readers, so hiding it visually
 *      loses nothing.
 *
 * 2. A MutationObserver that hides the "Need help?" prompt card while idle.
 *    It shares a single container with the in-call status card (same
 *    element, content cross-fades based on call state), so it can't be
 *    removed via static CSS without also hiding the in-call window — and a
 *    plain `display: none` in our stylesheet loses outright anyway, because
 *    that container carries Tailwind's `!flex` (a genuinely `!important`
 *    utility, sitting in Tailwind's own `@layer utilities`); an unlayered
 *    `!important` rule like ours always loses to a layered one, regardless
 *    of specificity (confirmed empirically, not just from spec-reading).
 *    Setting the property via `element.style.setProperty(..., "important")`
 *    instead sidesteps that entirely — inline style always wins over any
 *    stylesheet, layered or not. The card's container is found by walking up
 *    from the button (`button.closest(".overlay")`), and shown/hidden based
 *    on the button's colour-role class — `bg-accent` while idle, `bg-base`
 *    once a call is live (see ElevenLabsVoiceWidget.tsx's styles override)
 *    — the same locale-proofing as the CSS rules above, since colour role
 *    doesn't change with language.
 *
 * Fails safe throughout: if ElevenLabs renames these classes/slots in a
 * future release, the selectors just stop matching — the button reverts to
 * its native size with its default text and prompt card, nothing breaks.
 */
export function VoiceWidgetChromeOverrides() {
  useEffect(() => {
    const host = document.querySelector("elevenlabs-convai");
    if (!host) return;

    function injectStyle(root: ShadowRoot) {
      if (root.getElementById("rv-voice-widget-chrome")) return;
      const style = document.createElement("style");
      style.id = "rv-voice-widget-chrome";
      style.textContent = `
        button:has(> slot[name="icon-phone"]),
        button:has(> slot[name="icon-phone-off"]) {
          width: 60px !important;
          height: 60px !important;
          min-width: 60px !important;
          padding: 0 !important;
          margin: 0 !important;
          border-radius: 9999px !important;
        }
        button:has(> slot[name="icon-phone"]) > div,
        button:has(> slot[name="icon-phone-off"]) > div {
          display: none !important;
        }
      `;
      root.appendChild(style);
    }

    function updateBannerVisibility(root: ShadowRoot) {
      const btn = root.querySelector<HTMLElement>(
        'button:has(> slot[name="icon-phone"]), button:has(> slot[name="icon-phone-off"])',
      );
      const overlay = btn?.closest<HTMLElement>(".overlay");
      if (!overlay) return;
      const idle = btn!.classList.contains("bg-accent");
      if (idle) {
        overlay.style.setProperty("display", "none", "important");
      } else {
        overlay.style.removeProperty("display");
      }
    }

    function watch(root: ShadowRoot) {
      injectStyle(root);
      updateBannerVisibility(root);
      const observer = new MutationObserver(() => updateBannerVisibility(root));
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
      return observer;
    }

    if (host.shadowRoot) {
      const observer = watch(host.shadowRoot);
      return () => observer.disconnect();
    }

    // The embed script attaches the shadow root asynchronously after it
    // loads, so it isn't necessarily present on first mount — poll briefly
    // until it shows up (same approach as HideVoiceWidgetAvatar).
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
