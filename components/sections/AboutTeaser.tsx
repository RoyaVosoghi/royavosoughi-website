import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Guide's imagery rules: natural window light, real scene, green accent —
 * never stock photography. object-position is biased upward since the
 * source photo is a full-body shot; the 4:5 frame favours her face and
 * upper body over foot-level crop.
 */
export async function AboutTeaser() {
  const t = await getTranslations("about");

  return (
    <Section id="about" tone="mint">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <Reveal className="mx-auto w-full max-w-sm lg:mx-0">
          <div className="relative aspect-4/5 overflow-hidden rounded-3xl bg-forest">
            <Image
              src="/photos/roya-about.jpg"
              alt={t("photoAlt")}
              fill
              sizes="(min-width: 1024px) 24rem, 90vw"
              className="object-cover"
              style={{ objectPosition: "50% 30%" }}
              priority
            />
          </div>
        </Reveal>

        <Reveal delayMs={100}>
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
        </Reveal>
      </div>
    </Section>
  );
}
