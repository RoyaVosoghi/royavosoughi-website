/**
 * Single source of truth for identity + links.
 * Change it here, it changes everywhere (header, footer, metadata, JSON-LD).
 */
export const site = {
  name: "Roya Vosoughi",
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

/** Brand palette, mirrored from app/globals.css for use in TS (OG image, JSON-LD). */
export const brandColors = {
  forest: "#023316",
  emerald: "#0F7B4F",
  spring: "#35C97E",
  mint: "#DFF5E9",
  offwhite: "#F7FAF8",
  ink: "#1A1E1C",
  saffron: "#E3A72F",
} as const;
