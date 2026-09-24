/**
 * Nura lockup — "Nura: AI engineered for reality".
 *
 * The mark is a single-stroke N whose rising stroke ends in a Coral node: a
 * spark of light ("nur") that is also a network node. The N and the name
 * follow currentColor (Navy on light, Canvas on the Navy footer); the node
 * is always Coral.
 * The name is set in Space Grotesk. Always Latin — the wordmark does not change per
 * locale, and it is pinned to Space Grotesk even on Farsi pages.
 * Rules: never recolour the node, never stretch, min height 28px.
 */
export function NuraMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path
        d="M22 80 V24 L76 76 V40"
        fill="none"
        stroke="currentColor"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="76" cy="17" r="10" fill="#E07A5F" />
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
