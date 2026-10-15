import { Wordmark } from "@/components/ui/Logo";

export function PublicHeader({
  label,
  docNo,
  onDownload,
  downloading,
  labels,
}: {
  label: string;
  docNo: string;
  onDownload: () => void;
  downloading: boolean;
  labels: { download: string; preparing: string };
}) {
  return (
    <header className="sticky top-0 z-20 border-b-2 border-ink/10 bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Wordmark className="text-[1.25rem] text-ink" />
        <span className="hidden text-sm text-ink/55 sm:inline">
          · {label} <span dir="ltr">{docNo}</span>
        </span>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="ms-auto rounded-full border-2 border-ink/20 bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-mist/50 disabled:opacity-50"
        >
          {downloading ? labels.preparing : labels.download}
        </button>
      </div>
    </header>
  );
}
