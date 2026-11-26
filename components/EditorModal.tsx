"use client";

import React, { useState } from "react";
import type { Item, Status } from "@/lib/types";
import { Star, Trash2 } from "lucide-react";
import { useModalA11y } from "@/hooks/useModalA11y";

export default function EditorModal({
  item,
  onClose,
  onChange,
  onSave,
  onDelete,
}: {
  item: Item;
  onClose: () => void;
  onChange: (next: Item) => void;
  onSave: (payload: Omit<Item, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onDelete?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { containerRef, trapFocus } = useModalA11y(() => { if (!saving) onClose(); });
  const dialogLabel = onDelete ? "Edit title" : "Add title manually";

  // Focus + Escape handled by useModalA11y hook

  function set<K extends keyof Item>(key: K, value: Item[K]) {
    onChange({ ...item, [key]: value });
  }

  async function handleSave() {
    if (saving) return;
    if (!item.title.trim()) {
      setError("TITLE IS REQUIRED.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        title: item.title.trim(),
        tmdbId: item.tmdbId,
        year: item.year,
        genres: item.genres,
        mediaType: item.mediaType,
        status: item.status,
        favorite: item.favorite,
        coverUrl: item.coverUrl,
        notes: item.notes,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={dialogLabel}
      onKeyDown={trapFocus}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 font-mono text-xs"
    >
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto border border-tui-border bg-tui-panel shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-tui-border-muted flex items-center justify-between bg-tui-bg/30">
          <div>
            <div className="text-[9px] text-tui-text-muted uppercase tracking-widest">
              {/* EDIT_ENTRY_DATA */}
            </div>
            <div className="text-sm font-bold text-tui-text uppercase tracking-wider mt-0.5">
              {onDelete ? item.title || dialogLabel : dialogLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-2.5 py-1 border border-tui-border text-tui-text-muted hover:border-tui-text hover:text-tui-text uppercase transition-all"
            title="Cancel changes"
          >
            [X]
          </button>
        </div>

        {/* Form Fields */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="border border-tui-red/30 bg-tui-red/10 p-3 text-tui-red uppercase font-bold">
              ! ERROR: {error}
            </div>
          )}

          {/* Title Field */}
          <div className="space-y-1">
            <label htmlFor="editor-title" className="text-[10px] text-tui-text-muted uppercase font-bold tracking-wider select-none">
              TITLE &gt;
            </label>
            <input
              id="editor-title"
              data-dialog-autofocus
              type="text"
              maxLength={500}
              value={item.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="ENTER TITLE"
              className="w-full bg-tui-input border border-tui-border text-tui-text px-3 py-2 text-xs uppercase outline-none focus:border-tui-amber placeholder:text-tui-text-muted"
              autoComplete="off"
            />
          </div>

          {/* Year & Status Fields in Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="editor-year" className="text-[10px] text-tui-text-muted uppercase font-bold tracking-wider select-none">
                YEAR &gt;
              </label>
              <input id="editor-year"
                type="text"
                value={item.year ?? ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  set("year", val ? Number(val) : undefined);
                }}
                placeholder="YYYY"
                maxLength={4}
                className="w-full bg-tui-input border border-tui-border text-tui-text px-3 py-2 text-xs uppercase outline-none focus:border-tui-amber placeholder:text-tui-text-muted"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="editor-status" className="text-[10px] text-tui-text-muted uppercase font-bold tracking-wider select-none">
                STATUS &gt;
              </label>
              <select id="editor-status"
                value={item.status}
                onChange={(e) => set("status", e.target.value as Status)}
                className="w-full bg-tui-input border border-tui-border text-tui-text px-3 py-2 text-xs uppercase outline-none focus:border-tui-amber"
              >
                <option value="watched">WATCHED</option>
                <option value="pending">PENDING</option>
                <option value="wishlist">WISHLISTED</option>
              </select>
            </div>
          </div>

          {/* Genres Field */}
          <div className="space-y-1">
            <label htmlFor="editor-genres" className="text-[10px] text-tui-text-muted uppercase font-bold tracking-wider select-none">
              GENRES (COMMA SEPARATED) &gt;
            </label>
            <input id="editor-genres"
              type="text"
              value={(item.genres ?? []).join(", ")}
              onChange={(e) =>
                set(
                  "genres",
                  e.target.value
                    .split(",")
                    .map((g) => g.trim())
                    .filter(Boolean),
                )
              }
              placeholder="ACTION, SCI-FI, DRAMA"
              className="w-full bg-tui-input border border-tui-border text-tui-text px-3 py-2 text-xs uppercase outline-none focus:border-tui-amber placeholder:text-tui-text-muted"
              autoComplete="off"
            />
          </div>

          {/* Cover Url Field */}
          <div className="space-y-1">
            <label htmlFor="editor-cover" className="text-[10px] text-tui-text-muted uppercase font-bold tracking-wider select-none">
              COVER URL (OPTIONAL) &gt;
            </label>
            <input id="editor-cover"
              type="text"
              value={item.coverUrl ?? ""}
              onChange={(e) => set("coverUrl", e.target.value || undefined)}
              placeholder="HTTP://IMAGE.URL"
              className="w-full bg-tui-input border border-tui-border text-tui-text px-3 py-2 text-xs outline-none focus:border-tui-amber placeholder:text-tui-text-muted"
              autoComplete="off"
            />
          </div>

          {/* Notes Field */}
          <div className="space-y-1">
            <label htmlFor="editor-notes" className="text-[10px] text-tui-text-muted uppercase font-bold tracking-wider select-none">
              NOTES / COMMENTS &gt;
            </label>
            <textarea id="editor-notes"
              value={item.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="WRITE NOTES HERE..."
              maxLength={1000}
              rows={3}
              className="w-full bg-tui-input border border-tui-border text-tui-text px-3 py-2 text-xs uppercase outline-none focus:border-tui-amber placeholder:text-tui-text-muted resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-tui-border-muted flex items-center justify-between bg-tui-bg/30">
          <button
            onClick={() => set("favorite", !item.favorite)}
            className={`px-3 py-1.5 border transition-all duration-150 uppercase tracking-wider flex items-center gap-1.5 ${
              item.favorite
                ? "border-tui-amber text-tui-amber bg-tui-amber/10 font-bold"
                : "border-tui-border text-tui-text-muted hover:text-tui-text hover:border-tui-text"
            }`}
          >
            <Star
              className={`h-3.5 w-3.5 ${item.favorite ? "fill-current" : ""}`}
            />
            <span>{item.favorite ? "FAVORITED" : "FAVORITE"}</span>
          </button>

          <div className="flex gap-2 font-bold">
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={saving}
                className="px-3 py-1.5 border border-tui-red/30 text-tui-red bg-tui-red/10 hover:border-tui-red transition-all uppercase tracking-wider flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>DELETE</span>
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 border border-tui-border bg-tui-text text-tui-bg hover:bg-tui-text/90 transition-all uppercase tracking-wider"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
