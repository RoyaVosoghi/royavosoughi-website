/**
 * Aligned by role, not by text direction — justify-end/justify-start follow
 * the flex container's writing mode, so this flips correctly under dir="rtl"
 * with no left/right of its own.
 */
export function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-wrap sm:max-w-[70%] ${
          isUser ? "bg-forest text-offwhite" : "bg-mint text-ink"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
