import type { ReactNode } from "react";

type Tone = "light" | "mint" | "forest";

const tones: Record<Tone, string> = {
  light: "bg-canvas text-ink",
  mint: "bg-mist text-ink",
  forest: "bg-ink text-canvas",
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
  as: Heading = "h2",
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  tone?: Tone;
  /** h1 when the section is the whole page (e.g. /contact). */
  as?: "h1" | "h2";
}) {
  const onForest = tone === "forest";

  return (
    <header className="max-w-3xl">
      <p
        className={`label-eyebrow ${onForest ? "text-cobalt-light" : "text-cobalt"}`}
      >
        {eyebrow}
      </p>
      <Heading
        className={`text-section mt-4 ${onForest ? "text-canvas" : "text-ink"}`}
      >
        {title}
      </Heading>
      {intro ? (
        <p
          className={`mt-6 text-lg md:text-xl ${
            onForest ? "text-mist" : "text-ink/80"
          }`}
        >
          {intro}
        </p>
      ) : null}
    </header>
  );
}
