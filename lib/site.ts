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
  canvas: "#F5F5F7",
  navy: "#14213D",
  coral: "#E07A5F",
  mist: "#E6E6E6",
  navySoft: "#1F3158",
  fog: "#A9B4CC",
  coralDeep: "#AD4428",
  amber: "#E3A72F",
} as const;
