import { getLocale, getTranslations } from "next-intl/server";

import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

/** Each walk-away point gets a short title, the full sentence and its own bar colour. */
const points = [
  { key: "1", bar: "bg-cobalt", width: "w-[92%]" },
  { key: "2", bar: "bg-cobalt-light", width: "w-[84%]" },
  { key: "3", bar: "bg-ink/80", width: "w-[76%]" },
] as const;
const upcoming = ["webinars", "classes"] as const;

/**
 * The full /services page. The consultation is drawn as a slightly tilted
 * paper card with a stamp (it straightens on hover); upcoming offers get the
 * same card with a "coming soon" stamp. Tilts are decorative only — under
 * prefers-reduced-motion the hover transition is dropped.
 */
export async function ServicesDetail() {
  const t = await getTranslations("services");
  const locale = await getLocale();
  const num = new Intl.NumberFormat(locale);

  return (
    <Section tone="light" className="pt-14 md:pt-20">
      <SectionHeading
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        as="h1"
      />

      <div className="relative mt-14 overflow-hidden rounded-[2rem] bg-mist/70 px-6 py-14 md:px-12 md:py-20">
        {/* Decorative ring in the corner, as on a letterhead */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -start-28 -top-28 h-80 w-80 rounded-full border border-ink/10"
        />

        <div className="relative grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <Reveal>
            <article className="relative -rotate-2 rounded-2xl border border-ink/10 bg-canvas p-7 shadow-[0_28px_56px_-28px_rgba(30,30,30,0.4)] transition-transform duration-500 hover:rotate-0 motion-reduce:transition-none md:p-9">
              <header className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  dir="ltr"
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-cobalt text-xl font-bold text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  AI
                </span>
                <div>
                  <h2 className="text-xl text-ink md:text-2xl">{t("consultation.name")}</h2>
                  <p className="mt-1 text-sm font-semibold text-ink/60">
                    {t("consultation.duration")}
                  </p>
                </div>
              </header>

              <p className="label-eyebrow mt-8 text-cobalt">{t("consultation.walkAwayWith")}</p>
              <ol className="mt-5 space-y-6">
                {points.map(({ key, bar, width }, i) => (
                  <li key={key} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="w-5 shrink-0 pt-0.5 font-semibold text-cobalt"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {num.format(i + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-ink">{t(`consultation.t${key}`)}</h3>
                      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink/75">
                        {t(`consultation.p${key}`)}
                      </p>
                      <span
                        aria-hidden="true"
                        className={`mt-3 block h-1.5 -rotate-1 rounded-full ${bar} ${width}`}
                      />
                    </div>
                  </li>
                ))}
              </ol>

              {/* Stamp */}
              <span className="absolute -bottom-4 end-8 -rotate-6 border-2 border-cobalt bg-canvas px-3.5 py-1.5 text-sm font-bold text-cobalt shadow-sm">
                {t("consultation.free")}
              </span>
            </article>
          </Reveal>

          <Reveal delayMs={100}>
            <p className="label-eyebrow text-cobalt">{t("availableLabel")}</p>
            <p className="mt-5 text-xl leading-relaxed text-ink/85 md:text-2xl md:leading-relaxed">
              {t("consultation.summary")}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink href={`/${locale}/contact`} variant="primary">
                {t("consultation.cta")}
              </ButtonLink>
              <p className="text-sm text-ink/70">{t("consultation.note")}</p>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Roadmap — visible so the site reads as a growing practice */}
      <div className="mt-20">
        <h2 className="label-eyebrow text-cobalt">{t("soonTitle")}</h2>
        <div className="mt-8 grid gap-10 md:grid-cols-2">
          {upcoming.map((key, i) => (
            <Reveal key={key} delayMs={80 + i * 80}>
              <article
                className={`relative h-full rounded-2xl border border-ink/10 bg-canvas p-7 shadow-[0_20px_40px_-28px_rgba(30,30,30,0.35)] transition-transform duration-500 hover:rotate-0 motion-reduce:transition-none ${
                  i % 2 === 0 ? "rotate-1" : "-rotate-1"
                }`}
              >
                <h3 className="text-xl text-ink">{t(`${key}.name`)}</h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink/75">
                  {t(`${key}.summary`)}
                </p>
                <span aria-hidden="true" className="mt-5 block h-1.5 w-2/3 -rotate-1 rounded-full bg-ink/15" />
                <span className="absolute -top-3.5 end-6 rotate-3 border-2 border-dashed border-ink/40 bg-canvas px-3 py-1 text-sm font-semibold text-ink/70">
                  {t("soonLabel")}
                </span>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
