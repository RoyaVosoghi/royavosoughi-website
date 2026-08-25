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
 * 2. A MutationObserver that hides the "Need help?" label row while idle,
 *    leaving the button itself untouched. IMPORTANT: the button lives
 *    *inside* the same "card" element as that label — `.rounded-sheet` wraps
 *    two rows, the label row (avatar + "Need help?" text) first, the button
 *    row second — so hiding the whole card (an earlier version of this file
 *    did exactly that, via `button.closest(".overlay")`) hides the button
 *    along with the label, leaving nothing clickable at all. This instead
 *    walks up from the button to its card (`button.closest(".rounded-sheet")`)
 *    and hides only that card's *first* child (the label row) — the second
 *    child (the button's own row) is left alone. The card's own padding/
 *    background/shadow are also neutralized while idle, so what's left reads
 *    as a plain button rather than a mostly-empty padded card; both are
 *    restored once a call is live so the in-call window (status text + a
 *    real "End" button) looks like a proper card again.
 *
 *    A plain `display: none` in a stylesheet doesn't work here regardless —
 *    the card and its rows carry Tailwind's `!flex`/`!p-2` etc (genuinely
 *    `!important` utilities, sitting in Tailwind's own `@layer utilities`);
 *    an unlayered `!important` rule like a plain injected stylesheet's
 *    always loses to a layered one, regardless of specificity (confirmed
 *    empirically, not just from spec-reading). Setting the property via
 *    `element.style.setProperty(..., "important")` instead sidesteps that
 *    entirely — inline style always wins over any stylesheet, layered or
 *    not. Idle vs. in-call is read off the button's colour-role class —
 *    `bg-accent` while idle, `bg-base` once a call is live (see
 *    ElevenLabsVoiceWidget.tsx's styles override) — the same locale-proofing
 *    as the CSS rules above, since colour role doesn't change with language.
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
      const card = btn?.closest<HTMLElement>(".rounded-sheet");
      // The button's own row (card's 2nd child) must never be touched — only
      // ever read/write the label row (1st child) and the card's own chrome.
      const labelRow = card?.firstElementChild as HTMLElement | undefined;
      if (!card || !labelRow || labelRow.contains(btn)) return;

      const idle = btn!.classList.contains("bg-accent");
      if (idle) {
        labelRow.style.setProperty("display", "none", "important");
        card.style.setProperty("padding", "0", "important");
        card.style.setProperty("background", "transparent", "important");
        card.style.setProperty("box-shadow", "none", "important");
      } else {
        labelRow.style.removeProperty("display");
        card.style.removeProperty("padding");
        card.style.removeProperty("background");
        card.style.removeProperty("box-shadow");
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
