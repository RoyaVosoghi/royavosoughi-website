/**
 * Decorative product visual for the Hero — the thing Vercel/Stripe/Linear
 * put beside their headline instead of leaving it text-only. Content is
 * illustrative (not a real client project, never claimed as one) and stays
 * in English/code regardless of locale, same reasoning as the OG image:
 * code is not a translatable surface.
 *
 * Framing follows the brand guide's imagery rule for code/screenshots
 * verbatim: Deep Forest frame on a Mint background.
 */
export function HeroCodeCard({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      dir="ltr"
      className="rounded-3xl bg-mint p-3 shadow-[0_24px_60px_-24px_rgba(2,51,22,0.35)]"
    >
      <div className="overflow-hidden rounded-2xl bg-forest">
        <div className="flex items-center gap-2.5 bg-forest-soft/60 px-4 py-3">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-spring ring-4 ring-spring/20"
          />
          <span className="rounded-md bg-forest px-2.5 py-1 font-mono text-xs text-mint-deep">
            agent.py
          </span>
        </div>

        <pre className="overflow-x-auto px-5 py-6 font-mono text-[0.8125rem] leading-relaxed text-mint-deep">
          <code>
            <span className="text-spring">from</span> rag{" "}
            <span className="text-spring">import</span> KnowledgeBase
            {"\n"}
            <span className="text-spring">from</span> agents{" "}
            <span className="text-spring">import</span> Agent
            {"\n\n"}
            kb = KnowledgeBase.from_docs(<span className="text-offwhite">
              &quot;./company_docs&quot;
            </span>)
            {"\n"}
            agent = Agent(model=<span className="text-offwhite">&quot;gpt-4o&quot;</span>
            , tools=[kb]){"\n\n"}
            agent.run({"\n"}
            {"  "}
            <span className="text-offwhite">
              &quot;What&apos;s our refund policy?&quot;
            </span>
            {"\n"})
            {"\n"}
            <span className="text-mint-deep/60">
              # → answered from YOUR docs, not a guess
            </span>
            <span
              aria-hidden="true"
              className="cursor-blink ms-0.5 inline-block h-[1em] w-[0.5ch] -translate-y-0.5 bg-spring align-middle"
            />
          </code>
        </pre>
      </div>
    </div>
  );
}
