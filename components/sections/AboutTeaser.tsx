import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Section } from "@/components/ui/Section";

/**
 * Photo slot stays a framed placeholder until Roya sends real photos.
 * Guide's imagery rules: natural window light, real desk, green accent —
 * never stock photography.
 */
export async function AboutTeaser() {
  const t = await getTranslations("about");

  return (
    <Section id="about" tone="mint">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <div className="mx-auto w-full max-w-sm lg:mx-0">
          <div
            className="relative aspect-4/5 overflow-hidden rounded-3xl bg-forest"
            role="img"
            aria-label={t("photoAlt")}
          >
            <div className="absolute inset-0 grid place-items-center p-8 text-center">
              <div>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="mx-auto h-12 w-12"
                  fill="none"
                  stroke="var(--color-mint-deep)"
                  strokeWidth="1.5"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="8.5" cy="10" r="1.5" />
                  <path d="M21 16l-5-5-4.5 4.5L9 13l-6 6" />
                </svg>
                <p className="mt-4 text-sm text-mint-deep">
                  {t("photoPlaceholder")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="label-eyebrow text-emerald">{t("eyebrow")}</p>
          <h2 className="text-section mt-4 text-forest">{t("title")}</h2>
          <p className="mt-6 text-lg text-ink/80">{t("p1")}</p>
          <p className="mt-4 text-lg text-ink/80">{t("p2")}</p>

          <blockquote className="mt-8 border-s-4 border-emerald ps-5 text-xl text-forest italic">
            {t("quote")}
          </blockquote>

          <Link
            href="/about"
            className="mt-8 inline-block font-semibold text-emerald underline underline-offset-4 hover:text-forest"
          >
            {t("readMore")} →
          </Link>
        </div>
      </div>
    </Section>
  );
}
