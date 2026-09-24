"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function WidgetEmbedCode({ siteUrl, allowedDomains }: { siteUrl: string; allowedDomains: string[] }) {
  const t = useTranslations("channels.widgetEmbed");
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${siteUrl}/widget.js" async></script>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API can be denied — the code is still selectable/copyable by hand
    }
  }

  return (
    <section className="rounded-3xl border-2 border-navy/10 bg-canvas p-6">
      <h2 className="font-display text-lg font-bold text-navy">{t("title")}</h2>
      <p className="mt-1 text-sm text-navy/60">
        {t.rich("subtitle", { code: (chunks) => <span className="font-mono">{chunks}</span> })}
      </p>

      <div className="mt-4 flex items-center gap-3 rounded-xl border-2 border-navy/15 bg-navy/5 p-4">
        <code className="flex-1 overflow-x-auto font-mono text-sm text-navy">{snippet}</code>
        <button
          type="button"
          onClick={copy}
          className="rounded-full bg-coral px-4 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-coral-soft"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>

      <p className="mt-3 text-xs text-navy/50">
        {allowedDomains.length === 0 ? t("noDomains") : t("allowedDomains", { domains: allowedDomains.join(", ") })}
      </p>
    </section>
  );
}
