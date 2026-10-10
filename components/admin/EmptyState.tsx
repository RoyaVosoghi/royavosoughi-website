export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-ink/20 bg-mist/40 p-10 text-center">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      <p className="mt-2 text-ink/70">{body}</p>
    </div>
  );
}
