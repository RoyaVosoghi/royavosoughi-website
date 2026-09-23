export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-soft/20 bg-violet/10 p-10 text-center">
      <p className="font-display text-lg font-bold text-soft">{title}</p>
      <p className="mt-2 text-soft/70">{body}</p>
    </div>
  );
}
