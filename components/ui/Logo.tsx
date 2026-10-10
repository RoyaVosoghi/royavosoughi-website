/**
 * Roya Vosoughi lockup — "AI engineered for reality".
 *
 * The mark is a "Signal R": a rounded single-stroke R whose leg is the one
 * Cobalt stroke — the step from idea to working system. In the wordmark the
 * mark *is* the R of "Roya", so no letter is repeated; on its own it is the
 * favicon / app icon.
 * The R follows currentColor (Ink on light, Canvas on the Ink footer); the
 * leg is Cobalt on light and Cobalt-light on dark (raw cobalt is 2.1:1 on ink).
 * The name is set in Space Grotesk. Always Latin — the wordmark does not change
 * per locale, and it is pinned to Space Grotesk even on Farsi pages.
 * Rules: never recolour the leg outside the palette, never stretch, min height 20px.
 */
export function SignalR({
  className = "",
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <svg viewBox="0 0 74 100" aria-hidden="true" className={className}>
      <path
        d="M10 90 V10 H40 a22 22 0 0 1 0 44 H10"
        fill="none"
        stroke="currentColor"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="26"
        y1="54"
        x2="64"
        y2="90"
        className={onDark ? "stroke-cobalt-light" : "stroke-cobalt"}
        strokeWidth="20"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({
  className = "",
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span
      dir="ltr"
      className={`inline-flex items-baseline text-[1.6rem] leading-none font-bold tracking-[-0.04em] whitespace-nowrap ${className}`}
      style={{ fontFamily: "var(--font-space-grotesk), system-ui, sans-serif" }}
      aria-hidden="true"
    >
      {/* 0.7em ≈ Space Grotesk's cap height, so the mark sits as the "R" */}
      <SignalR onDark={onDark} className="h-[0.7em] w-auto" />
      <span className="ms-[0.02em]">oya</span>
      <span className="ms-[0.26em]">Vosoughi</span>
    </span>
  );
}
