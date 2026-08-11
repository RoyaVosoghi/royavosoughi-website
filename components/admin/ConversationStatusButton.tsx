"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConversationStatusButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const isClosed = status === "closed";

  async function toggle() {
    setPending(true);
    await fetch(`/api/admin/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: isClosed ? "active" : "closed" }),
    });
    router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        isClosed
          ? "border-forest/15 text-ink/60 hover:bg-forest/5"
          : "border-forest text-forest hover:bg-forest hover:text-offwhite"
      }`}
    >
      {isClosed ? "Reopen conversation" : "Close conversation"}
    </button>
  );
}
