import type { ReactNode } from "react";

/**
 * Shared bits for the V5 CRM screens (proposals, contracts, campaigns,
 * assistant) so the editors don't each re-declare the same input classes,
 * chips and spinner. Visual language follows the existing admin forms.
 */

export const inputClass =
  "w-full rounded-2xl border-2 border-ink/15 bg-canvas px-4 py-2.5 text-sm text-ink focus:border-cobalt focus:outline-none disabled:opacity-60";
export const textareaClass = `${inputClass} leading-relaxed`;
export const cardClass = "rounded-3xl border-2 border-ink/10 bg-canvas p-6";
export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-cobalt px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cobalt-dark disabled:opacity-50";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink/20 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-mist/50 disabled:opacity-50";
export const dangerButton =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-amber-deep/30 px-4 py-2 text-sm font-semibold text-amber-deep transition-colors hover:bg-amber/15 disabled:opacity-50";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-ink/10 text-ink",
  pending: "bg-ink/10 text-ink",
  sent: "bg-cobalt/10 text-cobalt",
  ready: "bg-cobalt/10 text-cobalt",
  viewed: "bg-cobalt/20 text-cobalt-dark",
  approved: "bg-cobalt text-white",
  accepted: "bg-cobalt text-white",
  converted: "bg-ink text-canvas",
  changes_requested: "bg-amber/25 text-amber-deep",
  failed: "bg-amber/25 text-amber-deep",
  declined: "bg-ink/5 text-ink/50",
  canceled: "bg-ink/5 text-ink/50",
  skipped: "bg-ink/5 text-ink/50",
};

export function StatusChip({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-ink/10 text-ink"}`}>
      {label}
    </span>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-semibold text-ink/60">{label}</span>
      {children}
      {hint ? <span className="text-xs text-ink/45">{hint}</span> : null}
    </label>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-e-transparent ${className}`}
    />
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "success"; children: ReactNode }) {
  const styles = {
    info: "border-cobalt/20 bg-cobalt/5 text-ink",
    warn: "border-amber/40 bg-amber/10 text-amber-deep",
    success: "border-cobalt/30 bg-cobalt/10 text-cobalt-dark",
  }[tone];
  return <div className={`rounded-2xl border-2 px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

/** Local date+time in the admin's browser — server components pass ISO strings through and format here so time zones match the reader. */
export function formatWhen(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(locale === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}
