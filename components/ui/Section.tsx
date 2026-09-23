import type { ReactNode } from "react";

type Tone = "light" | "mint" | "forest";

const tones: Record<Tone, string> = {
  light: "bg-indigo text-soft",
  mint: "bg-night/50 text-soft",
  forest: "bg-night text-soft",
};

export function Section({
  id,
  tone = "light",
  children,
  className = "",
}: {
  id?: string;
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`${tones[tone]} py-20 md:py-28 lg:py-32 ${className}`}
    >
      <div className="container-page">{children}</div>
    </section>
  );
}

/** Eyebrow + heading + optional intro. Keeps section headers consistent. */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  tone = "light",
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  tone?: Tone;
}) {
  const onForest = tone === "forest";

  return (
    <header className="max-w-3xl">
      <p className="label-eyebrow text-violet-soft">{eyebrow}</p>
      <h2 className="text-section mt-4 text-soft">{title}</h2>
      {intro ? (
        <p
          className={`mt-6 text-lg md:text-xl ${
            onForest ? "text-haze" : "text-soft/80"
          }`}
        >
          {intro}
        </p>
      ) : null}
    </header>
  );
}
