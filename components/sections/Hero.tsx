import { getLocale, getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/ui/Button";
import { HeroCodeCard } from "./HeroCodeCard";

/**
 * The first screenful. Text carries the sentence; the code card (desktop
 * only) gives it something to point at, the way Vercel/Stripe/Linear pair a
 * headline with a product visual instead of leaving it text-only. The
 * headline is split into three parts so the word "real" (the slogan's
 * "reality") can carry the cobalt underline; the slogan sits above it as the eyebrow.
 */
export async function Hero() {
  const t = await getTranslations("hero");
  const locale = await getLocale();

  return (
    <section className="relative flex min-h-[calc(100dvh-5rem)] items-center overflow-hidden py-16">
      {/* Soft cobalt + ink glow — depth without a hard shape. Decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(52rem 34rem at 28% 24%, color-mix(in srgb, var(--color-cobalt) 14%, transparent) 0%, transparent 70%), radial-gradient(44rem 30rem at 82% 70%, color-mix(in srgb, var(--color-ink) 7%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="container-page grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="text-center lg:text-start">
          <p className="rise-in label-eyebrow inline-flex items-center gap-2.5 rounded-full border border-ink/15 bg-canvas px-4 py-2 text-ink shadow-[0_1px_0_0_rgba(30,30,30,0.06)]">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-cobalt" />
            {t("eyebrow")}
          </p>

          <h1
            className="rise-in-solid text-display mx-auto mt-8 max-w-[19ch] text-ink lg:mx-0"
            style={{ animationDelay: "80ms" }}
          >
            {t("lineA")}{" "}
            <span className="relative inline-block">
              {t("lineB")}
              <span
                aria-hidden="true"
                className="underline-draw absolute inset-x-0 -bottom-1 h-[0.12em] rounded-full bg-cobalt"
              />
            </span>{" "}
            {t("lineC")}
          </h1>

          <p
            className="rise-in-solid mx-auto mt-10 max-w-[52ch] text-lg text-ink/75 md:text-xl lg:mx-0"
            style={{ animationDelay: "220ms" }}
          >
            {t("subtitle")}
          </p>

          <div
            className="rise-in mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start"
            style={{ animationDelay: "320ms" }}
          >
            <ButtonLink href={`/${locale}/contact`} variant="primary">
              {t("ctaPrimary")}
            </ButtonLink>
            <ButtonLink href="#projects" variant="secondary">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>

          <p
            className="rise-in mt-12 text-sm font-medium tracking-wide text-ink/70"
            style={{ animationDelay: "420ms" }}
          >
            {t("credential")}
          </p>
        </div>

        <div
          className="rise-in hidden lg:block"
          style={{ animationDelay: "260ms" }}
        >
          <HeroCodeCard label={t("codeCardLabel")} />
        </div>
      </div>
    </section>
  );
}
