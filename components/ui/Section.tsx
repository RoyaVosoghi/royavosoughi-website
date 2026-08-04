import type { ReactNode } from "react";

type Tone = "light" | "mint" | "forest";

const tones: Record<Tone, string> = {
  light: "bg-offwhite text-ink",
  mint: "bg-mint text-ink",
  forest: "bg-forest text-offwhite",
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
      <p
        className={`label-eyebrow ${onForest ? "text-spring" : "text-emerald"}`}
      >
        {eyebrow}
      </p>
      <h2
        className={`text-section mt-4 ${onForest ? "text-offwhite" : "text-forest"}`}
      >
        {title}
      </h2>
      {intro ? (
        <p
          className={`mt-6 text-lg md:text-xl ${
            onForest ? "text-mint" : "text-ink/80"
          }`}
        >
          {intro}
        </p>
      ) : null}
    </header>
  );
}
