export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-3xl border-2 border-navy/10 bg-canvas p-6">
      <p className="label-eyebrow text-coral-deep">{label}</p>
      <p className="mt-3 font-display text-4xl font-bold text-navy">{value}</p>
      {hint ? <p className="mt-1 text-sm text-navy/60">{hint}</p> : null}
    </div>
  );
}
