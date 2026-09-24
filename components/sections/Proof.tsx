import { getTranslations } from "next-intl/server";

import { Reveal } from "@/components/ui/Reveal";

/**
 * The four promises from the brand guide's positioning section — the exact
 * pains managers report with AI developers, answered one by one.
 */
const items = ["onTime", "real", "custom", "support"] as const;

export async function Proof() {
  const t = await getTranslations("proof");

  return (
    <section className="border-y border-navy/8 bg-canvas py-16 md:py-20">
      <div className="container-page">
        <h2 className="sr-only">{t("title")}</h2>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((key, i) => (
            <li key={key}>
              <Reveal
                delayMs={i * 80}
                className="rounded-2xl bg-mist p-6 transition-transform duration-200 hover:-translate-y-1"
              >
                <span
                  aria-hidden="true"
                  className="block font-mono text-sm font-bold text-coral-deep"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg text-navy">
                  {t(`${key}.title`)}
                </h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-navy/75">
                  {t(`${key}.body`)}
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
