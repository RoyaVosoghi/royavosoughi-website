import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Section } from "@/components/ui/Section";
import { ButtonLink } from "@/components/ui/Button";
import { site } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: `/${locale}/about`,
      languages: { en: "/en/about", fa: "/fa/about", "x-default": "/en/about" },
    },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aboutPage");

  const values = ["punctual", "practical", "creative", "inspiring"] as const;

  return (
    <>
      <Section tone="light" className="pt-14 md:pt-20">
        <div className="max-w-3xl">
          <p className="label-eyebrow text-cyan">{t("eyebrow")}</p>
          <h1 className="text-section mt-4 text-soft">{t("title")}</h1>
          <p className="mt-8 text-xl text-soft/80">{t("lead")}</p>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-16">
          <div className="space-y-5 text-lg text-soft/80">
            <p>{t("p1")}</p>
            <p>{t("p2")}</p>
            <p>{t("p3")}</p>

            {/* Placeholder until the CV and photos arrive — see README */}
            <div className="rounded-2xl border-2 border-dashed border-soft/20 bg-violet/10 p-6 text-base text-soft/70">
              {t("cvPlaceholder")}
            </div>
          </div>

          <aside>
            <h2 className="label-eyebrow text-cyan">{t("valuesTitle")}</h2>
            <dl className="mt-6 space-y-6">
              {values.map((key) => (
                <div key={key} className="border-s-2 border-cyan/30 ps-5">
                  <dt className="font-semibold text-soft">
                    {t(`values.${key}.name`)}
                  </dt>
                  <dd className="mt-1.5 text-soft/75">
                    {t(`values.${key}.body`)}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </Section>

      <Section tone="forest">
        <div className="text-center">
          <h2 className="text-section text-soft">{t("ctaTitle")}</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-soft/80">
            {t("ctaBody")}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <ButtonLink href={`/${locale}#contact`} variant="onDark">
              {t("ctaPrimary")}
            </ButtonLink>
            <ButtonLink
              href={site.social.linkedin}
              variant="onDarkGhost"
              target="_blank"
              rel="noreferrer noopener"
            >
              LinkedIn
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
