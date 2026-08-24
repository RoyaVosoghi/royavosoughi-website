import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/ui/Button";
import { HeroCodeCard } from "./HeroCodeCard";

/**
 * The first screenful. Text carries the sentence; the code card (desktop
 * only) gives it something to point at, the way Vercel/Stripe/Linear pair a
 * headline with a product visual instead of leaving it text-only. The
 * headline itself is split into two parts so the second half can carry the
 * Emerald colour.
 */
export async function Hero() {
  const t = await getTranslations("hero");

  return (
    <section className="relative flex min-h-[calc(100dvh-5rem)] items-center overflow-hidden py-16">
      {/* Soft Mint glow — warmth without a hard shape. Decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% 28%, var(--color-mint) 0%, transparent 70%)",
        }}
      />

      <div className="container-page grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="text-center lg:text-start">
          <h1
            className="rise-in-solid text-display mx-auto mt-8 max-w-[19ch] text-forest lg:mx-0"
            style={{ animationDelay: "80ms" }}
          >
            <span className="block">{t("lineA")}</span>
            <span className="relative inline-block text-emerald">
              {t("lineB")}
            </span>
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
            <ButtonLink href="#services" variant="primary">
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
