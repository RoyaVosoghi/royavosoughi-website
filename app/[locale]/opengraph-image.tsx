import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { brandColors, site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Roya Vosoughi — AI engineered for reality";

/**
 * Social share card: Ink background, Signal R wordmark, slogan.
 *
 * DELIBERATELY LATIN-SCRIPT FOR BOTH LOCALES.
 * Satori (the renderer behind ImageResponse) performs no Arabic contextual
 * shaping and no bidi reordering, so Persian text comes out with disconnected,
 * reversed letterforms — verified: a Persian tagline rendered with its
 * letters disconnected and reversed. A correct Latin card beats a garbled Persian one on
 * LinkedIn and Telegram previews.
 *
 * To get a real Persian card later: hand-make a 1200×630 PNG in the brand
 * colours, put it in public/, and point the `openGraph.images` field for the
 * fa locale at it. Do not try to fix this by loading Vazirmatn here — the
 * missing piece is the shaping engine, not the font.
 */
export default async function OpengraphImage() {
  // Space Grotesk Bold (OFL) so the card matches the site's wordmark.
  const spaceGrotesk = await readFile(
    join(process.cwd(), "assets/fonts/SpaceGrotesk-Bold.woff"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          backgroundColor: brandColors.ink,
          backgroundImage: `radial-gradient(circle at 18% 20%, ${brandColors.cobaltLight}33 0%, transparent 45%), radial-gradient(circle at 88% 85%, ${brandColors.inkSoft} 0%, transparent 45%)`,
          fontFamily: "Space Grotesk",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
          <svg width="29" height="39" viewBox="0 0 74 100" style={{ marginBottom: 11 }}>
            <path
              d="M10 90 V10 H40 a22 22 0 0 1 0 44 H10"
              fill="none"
              stroke={brandColors.canvas}
              strokeWidth="20"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line x1="26" y1="54" x2="64" y2="90" stroke={brandColors.cobaltLight} strokeWidth="20" strokeLinecap="round" />
          </svg>
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1,
              color: brandColors.canvas,
            }}
          >
            oya Vosoughi
          </span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 700,
            color: brandColors.canvas,
            lineHeight: 1.1,
            marginTop: 48,
            maxWidth: 980,
          }}
        >
          AI engineered for reality.
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: brandColors.cobaltLight,
            marginTop: 36,
          }}
        >
          AI Engineer &amp; Software Developer
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Space Grotesk", data: spaceGrotesk, weight: 700, style: "normal" }],
    },
  );
}
