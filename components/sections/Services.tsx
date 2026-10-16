import { getLocale, getTranslations } from "next-intl/server";

import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { serviceKeys } from "@/lib/service-options";

/**
 * Home-page teaser and the page's dark anchor: the five services at a glance.
 * The full cards and the request form live on /services (ServicesDetail).
 */
export async function Services() {
  const t = await getTranslations("services");
  const locale = await getLocale();
  const num = new Intl.NumberFormat(locale);

  return (
    <Section id="services" tone="forest" className="bg-dot-grid">
      <Reveal>
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
          tone="forest"
        />
      </Reveal>

      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {serviceKeys.map((key, i) => (
          <li key={key}>
            <Reveal delayMs={80 + i * 60} className="h-full rounded-3xl bg-canvas p-6">
              <span
                aria-hidden="true"
                className="label-eyebrow text-cobalt"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {num.format(i + 1)}
              </span>
              <h3 className="mt-3 text-lg text-ink">{t(`items.${key}.name`)}</h3>
              <p className="mt-2 text-sm font-semibold text-ink/60">{t(`items.${key}.duration`)}</p>
            </Reveal>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-4">
        <ButtonLink href={`/${locale}/services`} variant="onDark">
          {t("teaserLink")}
        </ButtonLink>
      </div>
    </Section>
  );
}
