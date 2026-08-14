import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev-only indicator defaults to bottom-left, which overlaps the
  // ElevenLabs widget there on the Farsi site (it tracks the logical
  // trailing corner). No effect on production builds.
  devIndicators: {
    position: "top-left",
  },
};

export default withNextIntl(nextConfig);
