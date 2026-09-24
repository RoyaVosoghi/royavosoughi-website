import type { ReactNode } from "react";

type Tone = "light" | "mint" | "forest";

const tones: Record<Tone, string> = {
  light: "bg-canvas text-navy",
  mint: "bg-mist text-navy",
  forest: "bg-navy text-canvas",
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
        className={`label-eyebrow ${onForest ? "text-coral" : "text-coral-deep"}`}
      >
        {eyebrow}
      </p>
      <h2
        className={`text-section mt-4 ${onForest ? "text-canvas" : "text-navy"}`}
      >
        {title}
      </h2>
      {intro ? (
        <p
          className={`mt-6 text-lg md:text-xl ${
            onForest ? "text-mist" : "text-navy/80"
          }`}
        >
          {intro}
        </p>
      ) : null}
    </header>
  );
}
