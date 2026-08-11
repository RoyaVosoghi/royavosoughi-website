/**
 * Aligned by role, not by text direction — justify-end/justify-start follow
 * the flex container's writing mode, so this flips correctly under dir="rtl"
 * with no left/right of its own.
 */
export function MessageBubble({
  role,
  content,
  feedback,
  onRate,
}: {
  role: "user" | "assistant";
  content: string;
  /** Only meaningful for assistant messages — undefined means "no messageId yet / not ratable", null means "ratable, not yet rated". */
  feedback?: 1 | -1 | null;
  onRate?: (rating: 1 | -1) => void;
}) {
  const isUser = role === "user";

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-wrap sm:max-w-[70%] ${
          isUser ? "bg-forest text-offwhite" : "bg-mint text-ink"
        }`}
      >
        {content}
      </div>

      {!isUser && onRate && feedback !== undefined ? (
        <div className="flex items-center gap-1 px-1">
          <button
            type="button"
            onClick={() => onRate(1)}
            disabled={feedback !== null}
            aria-label="Good response"
            aria-pressed={feedback === 1}
            className={`grid h-7 w-7 place-items-center rounded-full transition-colors disabled:cursor-default ${
              feedback === 1 ? "bg-emerald/15 text-emerald" : "text-ink/35 hover:bg-forest/5 hover:text-emerald"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h12.9a2 2 0 0 0 2-1.7l1.4-8A2 2 0 0 0 18.3 10H14V5a2 2 0 0 0-2-2L7 11" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onRate(-1)}
            disabled={feedback !== null}
            aria-label="Bad response"
            aria-pressed={feedback === -1}
            className={`grid h-7 w-7 place-items-center rounded-full transition-colors disabled:cursor-default ${
              feedback === -1 ? "bg-saffron-deep/15 text-saffron-deep" : "text-ink/35 hover:bg-forest/5 hover:text-saffron-deep"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 -scale-x-100 -scale-y-100" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h12.9a2 2 0 0 0 2-1.7l1.4-8A2 2 0 0 0 18.3 10H14V5a2 2 0 0 0-2-2L7 11" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
