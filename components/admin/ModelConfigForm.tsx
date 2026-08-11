"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ModelConfigRow {
  channel: "web" | "telegram" | "widget";
  provider: string;
  activeModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

const CHANNEL_LABELS: Record<ModelConfigRow["channel"], string> = {
  web: "Web (site + homepage bubble)",
  telegram: "Telegram",
  widget: "Embeddable widget",
};

function ChannelCard({ initial }: { initial: ModelConfigRow }) {
  const router = useRouter();
  const [row, setRow] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/admin/model-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  return (
    <div className="rounded-2xl border-2 border-forest/10 bg-mint/20 p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-bold text-forest">{CHANNEL_LABELS[row.channel]}</p>
        <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-medium text-ink/60">
          {row.provider}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="col-span-2 text-xs font-medium text-ink/70">
          Model
          <input
            type="text"
            value={row.activeModel}
            onChange={(e) => setRow({ ...row, activeModel: e.target.value })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          Temperature
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={row.temperature}
            onChange={(e) => setRow({ ...row, temperature: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          Top P
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={row.topP}
            onChange={(e) => setRow({ ...row, topP: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="col-span-2 text-xs font-medium text-ink/70">
          Max output tokens
          <input
            type="number"
            min={64}
            max={8192}
            value={row.maxTokens}
            onChange={(e) => setRow({ ...row, maxTokens: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-full bg-emerald px-5 py-2 text-sm font-semibold text-offwhite transition-colors hover:bg-forest disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {status === "saved" ? <span className="text-sm font-medium text-emerald">Saved.</span> : null}
        {status === "error" ? <span className="text-sm font-medium text-saffron-deep">Couldn't save.</span> : null}
      </div>
    </div>
  );
}

export function ModelConfigForm({ initial }: { initial: ModelConfigRow[] }) {
  return (
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">Model</h2>
      <p className="mt-1 text-sm text-ink/60">
        Per-channel generation settings, applied on the very next message. Provider is fixed to
        Gemini — cross-provider fallback and scheduled model switching aren't implemented yet.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {initial.map((row) => (
          <ChannelCard key={row.channel} initial={row} />
        ))}
      </div>
    </section>
  );
}
