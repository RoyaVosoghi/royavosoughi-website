import { ImageResponse } from "next/og";

import { brandColors, site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Nura — AI engineered for reality";

/**
 * Social share card: Navy background, Nura mark + wordmark, slogan.
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
export default function OpengraphImage() {
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
          backgroundColor: brandColors.navy,
          backgroundImage: `radial-gradient(circle at 18% 20%, ${brandColors.coral}33 0%, transparent 45%), radial-gradient(circle at 88% 85%, ${brandColors.navySoft} 0%, transparent 45%)`,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 100 100">
            <path
              d="M22 80 V24 L76 76 V40"
              fill="none"
              stroke={brandColors.canvas}
              strokeWidth="15"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="76" cy="17" r="10" fill={brandColors.coral} />
          </svg>
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: -2,
              color: brandColors.canvas,
            }}
          >
            nura
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
            color: brandColors.coral,
            marginTop: 36,
          }}
        >
          {site.name} · by {site.founder} · AI Engineer &amp; Software Developer
        </div>
      </div>
    ),
    size,
  );
}
