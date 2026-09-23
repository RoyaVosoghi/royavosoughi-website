import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/ui/Button";
import { HeroCodeCard } from "./HeroCodeCard";

/**
 * The first screenful. Text carries the sentence; the code card (desktop
 * only) gives it something to point at, the way Vercel/Stripe/Linear pair a
 * headline with a product visual instead of leaving it text-only. The
 * headline itself is split into two parts so the second half can carry the
 * Neon Cyan colour; the Nura slogan sits above it as the eyebrow.
 */
export async function Hero() {
  const t = await getTranslations("hero");

  return (
    <section className="relative flex min-h-[calc(100dvh-5rem)] items-center overflow-hidden py-16">
      {/* Violet → cyan aurora — depth without a hard shape. Decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(52rem 34rem at 30% 22%, color-mix(in srgb, var(--color-violet) 30%, transparent) 0%, transparent 70%), radial-gradient(40rem 30rem at 80% 70%, color-mix(in srgb, var(--color-cyan) 12%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="container-page grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="text-center lg:text-start">
          <p className="rise-in label-eyebrow inline-flex items-center gap-2.5 rounded-full border border-violet/40 bg-violet/10 px-4 py-2 text-violet-soft">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-cyan shadow-[0_0_10px_2px_rgba(0,229,255,0.6)]"
            />
            {t("eyebrow")}
          </p>

          <h1
            className="rise-in-solid text-display mx-auto mt-8 max-w-[19ch] text-soft lg:mx-0"
            style={{ animationDelay: "80ms" }}
          >
            <span className="block">{t("lineA")}</span>
            <span className="relative inline-block text-cyan">
              {t("lineB")}
            </span>
          </h1>

          <p
            className="rise-in-solid mx-auto mt-10 max-w-[52ch] text-lg text-soft/75 md:text-xl lg:mx-0"
            style={{ animationDelay: "220ms" }}
          >
            {t("subtitle")}
          </p>

          <div
            className="rise-in mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start"
            style={{ animationDelay: "320ms" }}
          >
            <ButtonLink href="#contact" variant="primary">
              {t("ctaPrimary")}
            </ButtonLink>
            <ButtonLink href="#projects" variant="secondary">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>

          <p
            className="rise-in mt-12 text-sm font-medium tracking-wide text-soft/70"
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
