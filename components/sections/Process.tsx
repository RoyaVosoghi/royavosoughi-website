import { getTranslations } from "next-intl/server";

import { Section, SectionHeading } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

/**
 * The funnel made visible: what already happens today (form → personal
 * reply → consultation → written summary, per the Services and Contact
 * copy) laid out as four steps, so a first-time visitor knows exactly what
 * they're signing up for before they scroll to the form.
 */
const steps = ["request", "reply", "call", "roadmap"] as const;

export async function Process() {
  const t = await getTranslations("process");

  return (
    <Section id="process" tone="mint">
      <Reveal>
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
        />
      </Reveal>

      <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((key, i) => (
          <li key={key}>
            <Reveal
              delayMs={i * 80}
              className="flex h-full flex-col rounded-3xl bg-offwhite p-7"
            >
              <span
                aria-hidden="true"
                className="font-mono text-sm font-bold text-emerald"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-xl text-forest">
                {t(`steps.${key}.name`)}
              </h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink/75">
                {t(`steps.${key}.body`)}
              </p>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
