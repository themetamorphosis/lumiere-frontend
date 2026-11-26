export default function LibraryLoadNotice({
  partial,
  message,
  onRetry,
}: {
  partial?: boolean;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-tui-border bg-tui-panel p-4 text-sm text-tui-text">
      <div>
        <p className="font-bold">{partial ? "Library view is incomplete" : "Could not load your library"}</p>
        <p className="mt-1">{message}</p>
      </div>
      <button type="button" onClick={onRetry} className="border border-tui-border px-3 py-2 font-bold underline underline-offset-4">
        Retry
      </button>
    </div>
  );
}
