"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export interface SettingsFormValues {
  systemPromptEn: string;
  systemPromptFa: string;
  chunkTargetChars: number;
  chunkMaxChars: number;
  chunkOverlapChars: number;
  retrievalTopK: number;
  similarityThreshold: number;
  summarizeAfterMessages: number;
}

const inputClass =
  "w-full rounded-2xl border-2 border-forest/15 bg-offwhite px-4 py-2.5 text-ink transition-colors focus:border-emerald focus:outline-none";
const labelClass = "mb-2 block text-sm font-medium text-ink/80";
const hintClass = "mt-1.5 text-xs text-ink/50";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint ? <p className={hintClass}>{hint}</p> : null}
    </div>
  );
}

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function set<K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-10">
      <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
        <h2 className="font-display text-lg font-bold text-forest">Persona</h2>
        <p className="mt-1 text-sm text-ink/60">
          The system prompt run before every reply, per locale. Leave a field empty and save to
          reset it to the built-in default.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Field label="System prompt — English">
            <textarea
              value={values.systemPromptEn}
              onChange={(e) => set("systemPromptEn", e.target.value)}
              rows={16}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
            />
          </Field>
          <Field label="System prompt — Persian">
            <textarea
              dir="rtl"
              value={values.systemPromptFa}
              onChange={(e) => set("systemPromptFa", e.target.value)}
              rows={16}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
        <h2 className="font-display text-lg font-bold text-forest">Retrieval</h2>
        <p className="mt-1 text-sm text-ink/60">How RAG context is fetched for each visitor message.</p>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field label="Chunks to retrieve (top_k)" hint="How many knowledge-base chunks to pull per question.">
            <input
              type="number"
              min={1}
              max={20}
              value={values.retrievalTopK}
              onChange={(e) => set("retrievalTopK", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field
            label="Similarity threshold"
            hint="0 = no filtering. 0.5+ = closely relevant only. Takes effect on the next message."
          >
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={values.similarityThreshold}
              onChange={(e) => set("similarityThreshold", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
        <h2 className="font-display text-lg font-bold text-forest">Chunking</h2>
        <p className="mt-1 text-sm text-ink/60">
          Only affects the <span className="font-mono">npm run ingest</span> — changing these
          doesn't rewrite chunks already stored. Re-ingest to apply.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Field label="Target size (characters)">
            <input
              type="number"
              min={100}
              max={4000}
              value={values.chunkTargetChars}
              onChange={(e) => set("chunkTargetChars", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Max size (characters)">
            <input
              type="number"
              min={100}
              max={6000}
              value={values.chunkMaxChars}
              onChange={(e) => set("chunkMaxChars", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Overlap (characters)">
            <input
              type="number"
              min={0}
              max={1000}
              value={values.chunkOverlapChars}
              onChange={(e) => set("chunkOverlapChars", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border-2 border-forest/10 bg-offwhite p-6">
        <h2 className="font-display text-lg font-bold text-forest">Memory</h2>
        <p className="mt-1 text-sm text-ink/60">
          Conversations longer than this get older messages folded into a running summary instead
          of sent verbatim, so context stays bounded.
        </p>

        <div className="mt-6 max-w-xs">
          <Field label="Summarize after N messages">
            <input
              type="number"
              min={4}
              max={200}
              value={values.summarizeAfterMessages}
              onChange={(e) => set("summarizeAfterMessages", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald px-7 py-3.5 text-base font-semibold text-offwhite shadow-[0_2px_0_0_var(--color-forest)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest hover:shadow-[0_4px_0_0_var(--color-forest)] disabled:pointer-events-none disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save settings"}
        </button>
        {status === "saved" ? <p className="text-sm font-medium text-emerald">Saved.</p> : null}
        {status === "error" ? (
          <p role="alert" className="text-sm font-medium text-saffron-deep">
            Couldn't save — try again.
          </p>
        ) : null}
      </div>
    </form>
  );
}
