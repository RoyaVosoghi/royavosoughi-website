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
    <div className="rounded-3xl border-2 border-soft/10 bg-indigo p-6">
      <p className="label-eyebrow text-cyan">{label}</p>
      <p className="mt-3 font-display text-4xl font-bold text-soft">{value}</p>
      {hint ? <p className="mt-1 text-sm text-soft/60">{hint}</p> : null}
    </div>
  );
}
