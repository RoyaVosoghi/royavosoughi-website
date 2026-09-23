/**
 * Decorative product visual for the Hero — the thing Vercel/Stripe/Linear
 * put beside their headline instead of leaving it text-only. Content is
 * illustrative (not a real client project, never claimed as one) and stays
 * in English/code regardless of locale, same reasoning as the OG image:
 * code is not a translatable surface.
 *
 * Framing follows the brand guide's imagery rule for code/screenshots
 * Nura version: a Deep Indigo code panel inside a violet → cyan glow frame.
 */
export function HeroCodeCard({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      dir="ltr"
      className="rounded-3xl border border-violet/30 bg-gradient-to-br from-violet/25 via-night to-cyan/15 p-3 shadow-[0_24px_80px_-24px_rgba(157,78,221,0.55)]"
    >
      <div className="overflow-hidden rounded-2xl bg-indigo">
        <div className="flex items-center gap-2.5 bg-night-soft/60 px-4 py-3">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-violet ring-4 ring-violet/25"
          />
          <span className="rounded-md bg-indigo px-2.5 py-1 font-mono text-xs text-haze">
            agent.py
          </span>
        </div>

        <pre className="overflow-x-auto px-5 py-6 font-mono text-[0.8125rem] leading-relaxed text-haze">
          <code>
            <span className="text-violet-soft">from</span> rag{" "}
            <span className="text-violet-soft">import</span> KnowledgeBase
            {"\n"}
            <span className="text-violet-soft">from</span> agents{" "}
            <span className="text-violet-soft">import</span> Agent
            {"\n\n"}
            kb = KnowledgeBase.from_docs(<span className="text-cyan">
              &quot;./company_docs&quot;
            </span>)
            {"\n"}
            agent = Agent(model=<span className="text-cyan">&quot;gpt-4o&quot;</span>
            , tools=[kb]){"\n\n"}
            agent.run({"\n"}
            {"  "}
            <span className="text-cyan">
              &quot;What&apos;s our refund policy?&quot;
            </span>
            {"\n"})
            {"\n"}
            <span className="text-haze/60">
              # → answered from YOUR docs, not a guess
            </span>
            <span
              aria-hidden="true"
              className="cursor-blink ms-0.5 inline-block h-[1em] w-[0.5ch] -translate-y-0.5 bg-violet align-middle"
            />
          </code>
        </pre>
      </div>
    </div>
  );
}
