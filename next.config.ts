import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Dev-only indicator defaults to bottom-left, which now overlaps
  // ChatBubble's launcher there — move it out of the way of both floating
  // widgets. No effect on production builds.
  devIndicators: {
    position: "top-left",
  },
};

export default withNextIntl(nextConfig);
