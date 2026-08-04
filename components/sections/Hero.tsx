import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/ui/Button";

/**
 * The first screenful. One sentence, centred, nothing competing with it.
 * The headline is split into two parts so the second half can carry the
 * Emerald colour and the underline that draws itself in — a literal reading
 * of "line by line".
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

      <div className="container-page text-center">
        <p
          className="rise-in inline-flex items-center gap-2.5 rounded-full border border-emerald/25 bg-offwhite/70 px-4 py-2 text-sm font-medium text-emerald"
          style={{ animationDelay: "0ms" }}
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-spring ring-4 ring-spring/25"
          />
          {t("badge")}
        </p>

        <h1
          className="rise-in-solid text-display mx-auto mt-8 max-w-[19ch] text-forest"
          style={{ animationDelay: "80ms" }}
        >
          <span className="block">{t("lineA")}</span>
          <span className="relative inline-block text-emerald">
            {t("lineB")}
            {/* The underline is decorative; it must never carry meaning */}
            <svg
              aria-hidden="true"
              viewBox="0 0 300 12"
              preserveAspectRatio="none"
              className="underline-draw absolute inset-x-0 -bottom-1 h-[0.18em] w-full overflow-visible"
              style={{ animationDelay: "600ms" }}
            >
              <path
                d="M2 8 Q75 2 150 6 T298 5"
                fill="none"
                stroke="var(--color-spring)"
                strokeWidth="7"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </span>
        </h1>

        <p
          className="rise-in-solid mx-auto mt-10 max-w-[52ch] text-lg text-ink/75 md:text-xl"
          style={{ animationDelay: "220ms" }}
        >
          {t("subtitle")}
        </p>

        <div
          className="rise-in mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
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
    </section>
  );
}
