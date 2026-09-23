import { getTranslations } from "next-intl/server";

import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

const consultationPoints = ["p1", "p2", "p3"] as const;
const upcoming = ["webinars", "classes"] as const;

/**
 * The page's dark anchor. One real service, described in terms of what the
 * client walks away with. Booking + payment arrive in Phase 2 — until then the
 * CTA opens the contact form with the subject pre-filled.
 */
export async function Services() {
  const t = await getTranslations("services");

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

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {/* Primary offer */}
        <Reveal
          delayMs={80}
          className="rounded-3xl bg-indigo p-8 md:p-10 lg:col-span-2"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl text-soft md:text-3xl">
              {t("consultation.name")}
            </h3>
            <span className="rounded-full bg-night px-3 py-1 text-sm font-semibold text-cyan">
              {t("consultation.duration")}
            </span>
            <span className="rounded-full bg-amber/20 px-3 py-1 text-sm font-semibold text-amber-soft">
              {t("consultation.free")}
            </span>
          </div>

          <p className="mt-5 text-lg text-soft/80">{t("consultation.summary")}</p>

          <h4 className="label-eyebrow mt-8 text-cyan">
            {t("consultation.walkAwayWith")}
          </h4>
          <ul className="mt-4 space-y-3">
            {consultationPoints.map((key) => (
              <li key={key} className="flex gap-3 text-soft/80">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="mt-1 h-5 w-5 shrink-0"
                  fill="none"
                  stroke="var(--color-cyan)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12.5 L9.5 18 L20 6" />
                </svg>
                <span>{t(`consultation.${key}`)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <ButtonLink href="#contact" variant="primary">
              {t("consultation.cta")}
            </ButtonLink>
            <p className="text-sm text-soft/70">{t("consultation.note")}</p>
          </div>
        </Reveal>

        {/* Roadmap — visible so the site reads as a growing practice */}
        <div className="flex flex-col gap-6">
          {upcoming.map((key, i) => (
            <Reveal
              key={key}
              delayMs={160 + i * 80}
              className="flex-1 rounded-3xl border border-haze/25 p-8"
            >
              <span className="label-eyebrow text-violet-soft">{t("soonLabel")}</span>
              <h3 className="mt-3 text-xl text-soft">{t(`${key}.name`)}</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-soft/80">
                {t(`${key}.summary`)}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
