/**
 * Single source of truth for identity + links.
 * Change it here, it changes everywhere (header, footer, metadata, JSON-LD).
 */
export const site = {
  name: "Nura",
  slogan: "AI engineered for reality",
  /** The person behind the brand — used for authorship / JSON-LD Person. */
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
  indigo: "#0F0C29",
  violet: "#9D4EDD",
  cyan: "#00E5FF",
  soft: "#F8F9FA",
  night: "#1A1640",
  haze: "#AAA5D4",
  violetSoft: "#C79BF2",
  amber: "#F5B942",
} as const;
