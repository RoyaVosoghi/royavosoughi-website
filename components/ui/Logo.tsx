/**
 * Nura lockup — "Nura: AI engineered for reality".
 *
 * The mark is a single-stroke N in Electric Violet whose rising stroke ends in
 * a Neon Cyan node: a spark of light ("nur") that is also a network node.
 * The name is set in Space Grotesk and fills with currentColor so the header
 * and footer can colour it. Always Latin — the wordmark does not change per
 * locale, and it is pinned to Space Grotesk even on Farsi pages.
 * Rules: never recolour the mark, never stretch, min height 28px.
 */
export function NuraMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path
        d="M22 80 V24 L76 76 V40"
        fill="none"
        stroke="#9D4EDD"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="76" cy="17" r="10" fill="#00E5FF" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      dir="ltr"
      className={`inline-flex h-9 items-center gap-2.5 ${className}`}
      aria-hidden="true"
    >
      <NuraMark className="h-full w-auto" />
      <span
        className="text-[1.75rem] leading-none font-bold tracking-[-0.04em]"
        style={{
          fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
        }}
      >
        nura
      </span>
    </span>
  );
}
