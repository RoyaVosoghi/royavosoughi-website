"use client";

import { useEffect } from "react";

/**
 * ElevenLabs' "tiny" call button has no config field for its size — it's a
 * hardcoded 36x36px (Tailwind's `h-9` utility, wrapped in a `p-2`-padded
 * ~52px "sheet" div) baked into their widget bundle, confirmed by reading
 * their compiled classes directly; no variant or override-config field
 * reaches it. To bring it visually in harmony with our own 60px text-chat
 * bubble (lib/widget/entry.ts's `.rv-launcher`), this forces the button and
 * its sheet wrapper up to that same 60px via an injected stylesheet in the
 * widget's shadow DOM.
 *
 * PhoneIconSlot itself is untouched: its slot wrapper is centered via flex
 * inside the button independently of the button's own box size, so growing
 * the button doesn't shift or resize the icon — it just gives it more
 * forest circle around it, matching the chat bubble's proportions.
 *
 * The same `.rounded-compact-sheet` markup is reused for the in-call "end
 * call" button (confirmed by inspecting the widget mid-call), so this rule
 * keeps the button a consistent 60px in both states.
 *
 * A <style> tag (rather than direct inline-style writes, which the widget's
 * own re-renders would just overwrite) persists across those re-renders on
 * its own as long as the class names stay stable, so — unlike
 * HideVoiceWidgetAvatar's target, which gets recreated — this doesn't need
 * a MutationObserver to keep re-applying itself. Fails safe: if ElevenLabs
 * renames these classes in a future release, the selectors just stop
 * matching and the button quietly reverts to its native 36px.
 */
export function ResizeVoiceWidgetButton() {
  useEffect(() => {
    const host = document.querySelector("elevenlabs-convai");
    if (!host) return;

    function inject(root: ShadowRoot) {
      if (root.getElementById("rv-voice-btn-size")) return;
      const style = document.createElement("style");
      style.id = "rv-voice-btn-size";
      style.textContent = `
        .rounded-compact-sheet {
          width: 60px !important;
          height: 60px !important;
          padding: 0 !important;
          border-radius: 9999px !important;
        }
        .rounded-compact-sheet > button.rounded-button {
          width: 60px !important;
          height: 60px !important;
          min-width: 60px !important;
          margin: 0 !important;
          border-radius: 9999px !important;
        }
      `;
      root.appendChild(style);
    }

    if (host.shadowRoot) {
      inject(host.shadowRoot);
      return;
    }

    // The embed script attaches the shadow root asynchronously after it
    // loads, so it isn't necessarily present on first mount — poll briefly
    // until it shows up (same approach as HideVoiceWidgetAvatar).
    const interval = setInterval(() => {
      if (host.shadowRoot) {
        clearInterval(interval);
        inject(host.shadowRoot);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return null;
}
