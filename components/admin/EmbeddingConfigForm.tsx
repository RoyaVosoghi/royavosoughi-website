"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface EmbeddingConfigValues {
  provider: string;
  model: string;
  dimensions: number;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
}

export function EmbeddingConfigForm({ initial }: { initial: EmbeddingConfigValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    const response = await fetch("/api/admin/embedding-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chunkSize: values.chunkSize,
        chunkOverlap: values.chunkOverlap,
        topK: values.topK,
        similarityThreshold: values.similarityThreshold,
      }),
    });
    setStatus(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }

  return (
    <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
      <h2 className="font-display text-lg font-bold text-forest">Embedding &amp; retrieval</h2>
      <p className="mt-1 text-sm text-ink/60">
        {values.provider} · {values.model} · {values.dimensions} dimensions — fixed, since changing
        the embedding model would invalidate every vector already stored. Chunk size/overlap apply
        on the next <span className="font-mono">npm run ingest</span>; top_k and the similarity
        threshold apply on the next message.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-ink/70">
          Chunk size (chars)
          <input
            type="number"
            min={100}
            max={6000}
            value={values.chunkSize}
            onChange={(e) => setValues({ ...values, chunkSize: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          Chunk overlap (chars)
          <input
            type="number"
            min={0}
            max={1000}
            value={values.chunkOverlap}
            onChange={(e) => setValues({ ...values, chunkOverlap: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          top_k
          <input
            type="number"
            min={1}
            max={20}
            value={values.topK}
            onChange={(e) => setValues({ ...values, topK: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          Similarity threshold
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={values.similarityThreshold}
            onChange={(e) => setValues({ ...values, similarityThreshold: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border-2 border-forest/15 bg-offwhite px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
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
    </section>
  );
}
