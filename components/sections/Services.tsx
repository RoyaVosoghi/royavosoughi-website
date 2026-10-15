import { getLocale, getTranslations } from "next-intl/server";

import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

const offers = [
  { key: "consultation", available: true },
  { key: "webinars", available: false },
  { key: "classes", available: false },
] as const;

/**
 * Home-page teaser and the page's dark anchor: what's on offer at a glance.
 * The full description lives on /services (ServicesDetail).
 */
export async function Services() {
  const t = await getTranslations("services");
  const locale = await getLocale();

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

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {offers.map(({ key, available }, i) => (
          <Reveal
            key={key}
            delayMs={80 + i * 80}
            className={`rounded-3xl p-7 ${available ? "bg-canvas" : "border border-fog/25"}`}
          >
            <div>
              <span
                className={`label-eyebrow ${available ? "text-cobalt" : "text-cobalt-light"}`}
              >
                {available ? t("availableLabel") : t("soonLabel")}
              </span>
              <h3 className={`mt-3 text-xl ${available ? "text-ink" : "text-canvas"}`}>
                {t(`${key}.name`)}
              </h3>
              {available ? (
                <p className="mt-2 text-sm font-semibold text-ink/60">
                  {t("consultation.duration")} · {t("consultation.free")}
                </p>
              ) : null}
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-4">
        <ButtonLink href={`/${locale}/services`} variant="onDark">
          {t("teaserLink")}
        </ButtonLink>
        <ButtonLink href={`/${locale}/contact`} variant="onDarkGhost">
          {t("consultation.cta")}
        </ButtonLink>
      </div>
    </Section>
  );
}
