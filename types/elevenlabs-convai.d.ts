import type { DetailedHTMLProps, HTMLAttributes } from "react";

// The ElevenLabs Conversational AI widget (loaded via <Script> in
// ElevenLabsVoiceWidget.tsx) registers this as a custom element at runtime —
// TS doesn't know about it otherwise.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          "agent-id": string;
          variant?: "tiny" | "compact" | "full";
          "avatar-orb-color-1"?: string;
          "avatar-orb-color-2"?: string;
        },
        HTMLElement
      >;
    }
  }
}
