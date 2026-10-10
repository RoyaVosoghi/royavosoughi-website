/**
 * Single source of truth for identity + links.
 * Change it here, it changes everywhere (header, footer, metadata, JSON-LD).
 */
export const site = {
  name: "Roya Vosoughi",
  slogan: "AI engineered for reality",
  /** The person — the brand is her own name. Used for authorship / JSON-LD Person. */
  founder: "Roya Vosoughi",
  domain: "royavosoughi.com",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://royavosoughi.com",
  email: "Roya.vosoughii@gmail.com",
  social: {
    linkedin: "https://www.linkedin.com/in/royavosoughi",
    github: "https://github.com/royavosoughi",
    instagram: "https://www.instagram.com/royavosoughi",
  },
} as const;

/** Brand palette, mirrored from app/globals.css for use in TS (OG image, charts, email). */
export const brandColors = {
  canvas: "#F5EBE0",
  ink: "#1E1E1E",
  cobalt: "#0047AB",
  mist: "#EBDFD1",
  inkSoft: "#2E2E2E",
  fog: "#B8B0A6",
  cobaltLight: "#7FA6E8",
  amber: "#E3A72F",
} as const;
