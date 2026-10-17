import { getLocale, getTranslations } from "next-intl/server";

import { Section, SectionHeading } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase";
import { serviceKeys } from "@/lib/service-options";

import { ServiceRequestDialog } from "./ServiceRequestDialog";

const details = ["for", "problem", "deliverable", "duration", "price"] as const;

/** Each card gets its own accent bar under the title. */
const bars = ["bg-cobalt", "bg-cobalt-light", "bg-ink/80", "bg-cobalt", "bg-cobalt-light"] as const;

/**
 * The full /services page: one tilted paper card per service (they straighten
 * on hover), each with a "Register / Request" button that opens the request
 * form with that service pre-selected. Tilts are decorative only — under
 * prefers-reduced-motion the hover transition is dropped.
 */
export async function ServicesDetail() {
  const t = await getTranslations("services");
  const locale = await getLocale();
  const num = new Intl.NumberFormat(locale);
  const configured = isSupabaseConfigured();

  return (
    <Section tone="light" className="pt-14 md:pt-20">
      <SectionHeading
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        as="h1"
      />

      <div className="relative mt-14 overflow-hidden rounded-[2rem] bg-mist/70 px-5 py-12 md:px-10 md:py-16">
        {/* Decorative ring in the corner, as on a letterhead */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -start-28 -top-28 h-80 w-80 rounded-full border border-ink/10"
        />

        <ol className="relative grid gap-10 md:grid-cols-2 xl:grid-cols-3">
          {serviceKeys.map((key, i) => (
            <li key={key}>
              <Reveal delayMs={60 + (i % 3) * 80} className="h-full">
                <article
                  className={`flex h-full flex-col rounded-2xl border border-ink/10 bg-canvas p-6 shadow-[0_20px_40px_-24px_rgba(30,30,30,0.4)] transition-transform duration-500 hover:rotate-0 motion-reduce:transition-none md:p-7 ${
                    i % 2 === 0 ? "-rotate-1" : "rotate-1"
                  }`}
                >
                  <header className="flex items-center gap-4">
                    <span
                      aria-hidden="true"
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cobalt text-lg font-bold text-on-cobalt"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {num.format(i + 1)}
                    </span>
                    <h2 className="text-xl text-ink md:text-2xl">{t(`items.${key}.name`)}</h2>
                  </header>
                  <span
                    aria-hidden="true"
                    className={`mt-5 block h-1.5 w-2/3 -rotate-1 rounded-full ${bars[i]}`}
                  />

                  <dl className="mt-6 flex-1 space-y-4">
                    {details.map((detail) => (
                      <div key={detail}>
                        <dt className="label-eyebrow text-cobalt">{t(`labels.${detail}`)}</dt>
                        <dd className="mt-1 text-[0.9375rem] leading-relaxed text-ink/80">
                          {t(`items.${key}.${detail}`)}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-8">
                    {configured ? (
                      <ServiceRequestDialog service={key} email={site.email} />
                    ) : (
                      <ButtonLink href={`/${locale}/contact`}>{t("cta")}</ButtonLink>
                    )}
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
