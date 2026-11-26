"use client";

import { useMemo, useRef, useState } from "react";
import { useModalA11y } from "@/hooks/useModalA11y";
import { parseLibraryImport, type LibraryImportEntry, type LibraryImportFormat } from "@/lib/libraryImport";
import type { ImportOutcome, ImportResult, MediaType, Status } from "@/lib/types";

const statusLabel = { watched: "Watched", pending: "Watching", wishlist: "Wishlist" };
const resultLabel = {
  imported: "Imported",
  duplicate: "Already present",
  unconfirmed: "Could not confirm",
};

export default function ImportModal({
  defaultMediaType = "movie",
  defaultStatus = "watched",
  onClose,
  onImport,
}: {
  defaultMediaType?: MediaType;
  defaultStatus?: Status;
  onClose: () => void;
  onImport: (items: LibraryImportEntry[]) => Promise<ImportResult>;
}) {
  const [source, setSource] = useState("");
  const [format, setFormat] = useState<LibraryImportFormat>();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportResult>();
  const [showAll, setShowAll] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const { containerRef, trapFocus } = useModalA11y(() => { if (!busy) onClose(); });
  const rows = useMemo(
    () => parseLibraryImport(source, defaultMediaType, defaultStatus, format),
    [source, defaultMediaType, defaultStatus, format],
  );
  const validRows = rows.filter((row) => "entry" in row);
  const invalidCount = rows.length - validRows.length;
  const outcomes = new Map(validRows.map((row, index) => [row.row, results?.results[index]]));
  const visible = showAll ? rows : rows.slice(0, 6);

  function updateSource(value: string, fileFormat?: LibraryImportFormat) {
    setSource(value);
    setFormat(fileFormat);
    setResults(undefined);
    setShowAll(false);
    setFileError("");
  }

  async function runImport() {
    setBusy(true);
    try {
      const pending = validRows.flatMap((row, index) =>
        !results || results.results[index] === "unconfirmed" ? [{ index, entry: row.entry }] : [],
      );
      const response = await onImport(pending.map((row) => row.entry));
      const outcomes: ImportOutcome[] = results ? [...results.results] : validRows.map(() => "unconfirmed");
      pending.forEach(({ index }, position) => { outcomes[index] = response.results[position] ?? "unconfirmed"; });
      setResults({
        imported: outcomes.filter((value) => value === "imported").length,
        skipped: outcomes.filter((value) => value === "duplicate").length,
        failed: outcomes.filter((value) => value === "unconfirmed").length,
        results: outcomes,
      });
    } catch {
      if (!results) {
        setResults({
          imported: 0,
          skipped: 0,
          failed: validRows.length,
          results: validRows.map(() => "unconfirmed"),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={containerRef} tabIndex={-1} onKeyDown={trapFocus} role="dialog" aria-modal="true" aria-labelledby="library-import-title"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 text-tui-text">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col border border-tui-border bg-tui-panel shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-tui-border p-4">
          <h2 id="library-import-title" className="font-mono text-lg font-bold">Import titles</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close import" className="border border-tui-border px-3 py-2">✕</button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          <div>
            <p className="mb-2 text-sm">Use one title per line, CSV with headers, or a JSON array. Include a release year to distinguish editions.</p>
            <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="border border-tui-border px-3 py-2">
              Upload TXT, CSV, or JSON
            </button>
            <input ref={fileInput} type="file" accept=".txt,.csv,.json" className="hidden" onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const extension = file.name.split(".").at(-1)?.toLowerCase();
              const fileFormat = extension === "csv" || extension === "json" || extension === "txt" ? extension : undefined;
              try { updateSource(await file.text(), fileFormat); } catch { setFileError("Could not read that file."); }
            }} />
          </div>
          {fileError && <p role="alert">{fileError}</p>}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Paste titles</span>
            <textarea value={source} disabled={busy} onChange={(event) => updateSource(event.target.value)}
              placeholder={'Title,Year,Status,Favorite\n"Paris, Texas",1984,watched,true'}
              className="min-h-32 w-full border border-tui-border bg-tui-input p-3 text-sm focus:border-tui-amber" />
          </label>
          {rows.length > 0 && (
            <section aria-label={results ? "Import report" : "Import preview"} className="space-y-2">
              <p role="status" className="text-sm font-bold">
                {results
                  ? `${results.imported} imported · ${results.skipped} already present · ${results.failed} unconfirmed · ${invalidCount} invalid`
                  : `${validRows.length} ready to import · ${invalidCount} invalid`}
              </p>
              {results?.failed ? <p className="text-sm">You can retry safely. Titles already saved will be skipped.</p> : null}
              <ol className="max-h-64 space-y-1 overflow-y-auto">
                {visible.map((row) => {
                  const outcome = outcomes.get(row.row);
                  return (
                    <li key={row.row} className="border border-tui-border p-2 text-sm">
                      <span className="font-semibold">{row.row}. {row.title || "Untitled"}</span>
                      {"entry" in row ? (
                        <span> · {[row.entry.year, row.entry.mediaType, statusLabel[row.entry.status], row.entry.favorite ? "Favorite" : null].filter(Boolean).join(" · ")}
                          {outcome && <strong> · {resultLabel[outcome]}</strong>}
                        </span>
                      ) : <span> · Skipped: {row.error}</span>}
                    </li>
                  );
                })}
              </ol>
              {rows.length > 6 && (
                <button type="button" onClick={() => setShowAll(!showAll)} className="text-sm underline">
                  {showAll ? "Show fewer rows" : `Show all ${rows.length} rows`}
                </button>
              )}
            </section>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-tui-border p-4">
          <button type="button" onClick={onClose} disabled={busy} className="border border-tui-border px-3 py-2">Done</button>
          <button type="button" onClick={runImport} disabled={busy || !validRows.length || Boolean(results && !results.failed)}
            className="bg-tui-text px-3 py-2 font-bold text-tui-bg disabled:opacity-50">
            {busy ? "Importing…" : results?.failed ? "Retry import" : `Import ${validRows.length || ""} titles`}
          </button>
        </div>
      </div>
    </div>
  );
}
