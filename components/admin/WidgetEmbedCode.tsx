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
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">{t("title")}</h2>
      <p className="mt-1 text-sm text-ink/60">
        {t.rich("subtitle", { code: (chunks) => <span className="font-mono">{chunks}</span> })}
      </p>

      <div className="mt-4 flex items-center gap-3 rounded-xl border-2 border-forest/15 bg-forest/5 p-4">
        <code className="flex-1 overflow-x-auto font-mono text-sm text-forest">{snippet}</code>
        <button
          type="button"
          onClick={copy}
          className="rounded-full bg-emerald px-4 py-1.5 text-xs font-semibold text-offwhite transition-colors hover:bg-forest"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink/50">
        {allowedDomains.length === 0 ? t("noDomains") : t("allowedDomains", { domains: allowedDomains.join(", ") })}
      </p>
    </section>
  );
}
