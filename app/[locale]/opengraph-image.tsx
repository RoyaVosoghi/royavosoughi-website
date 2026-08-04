import { ImageResponse } from "next/og";

import { brandColors, site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Roya Vosoughi — AI Engineer & Software Developer";

/**
 * Social share card: Deep Forest background, wordmark, tagline.
 *
 * DELIBERATELY LATIN-SCRIPT FOR BOTH LOCALES.
 * Satori (the renderer behind ImageResponse) performs no Arabic contextual
 * shaping and no bidi reordering, so Persian text comes out with disconnected,
 * reversed letterforms — verified: «رویا رو خط‌به‌خط می‌سازم» rendered as
 * "ایور رو طخاهباطخ". A correct Latin card beats a garbled Persian one on
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
          backgroundColor: brandColors.forest,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: brandColors.offwhite,
            }}
          >
            roya
          </span>
          <svg width="46" height="40" viewBox="0 0 40 34" fill="none">
            <path
              d="M4 18 L14 28 L36 5"
              stroke={brandColors.spring}
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 82,
            fontWeight: 700,
            color: brandColors.offwhite,
            lineHeight: 1.15,
            marginTop: 44,
            maxWidth: 940,
          }}
        >
          Building a dream, line by line.
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: brandColors.spring,
            marginTop: 34,
          }}
        >
          {site.name} · AI Engineer &amp; Software Developer
        </div>
      </div>
    ),
    size,
  );
}
