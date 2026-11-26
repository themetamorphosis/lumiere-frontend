"use client";

import { useState } from "react";
import type { MediaType, ShareLink, Status } from "@/lib/types";
import type { ShareLinkInput } from "@/app/actions/share";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "watched", label: "Watched" },
  { value: "pending", label: "Watching" },
  { value: "wishlist", label: "Wishlist" },
];

const TYPE_OPTIONS: { value: MediaType; label: string }[] = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "anime", label: "Anime" },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/**
 * Create/edit form for a share link. One component for both so the filter
 * semantics — nothing selected means "share everything" — are stated once.
 */
export default function ShareLinkForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  /** Editing an existing link keeps the handle: changing it breaks every copy
   * of the URL already handed out. */
  lockSlug = false,
}: {
  initial?: ShareLink;
  submitLabel: string;
  onSubmit: (input: ShareLinkInput) => Promise<string | null>;
  onCancel?: () => void;
  lockSlug?: boolean;
}) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [statuses, setStatuses] = useState<Status[]>(initial?.statuses ?? []);
  const [mediaTypes, setMediaTypes] = useState<MediaType[]>(
    initial?.mediaTypes ?? [],
  );
  const [favoritesOnly, setFavoritesOnly] = useState(
    initial?.favoritesOnly ?? false,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const message = await onSubmit({
      ...(lockSlug ? {} : { slug: slug.trim().toLowerCase() }),
      label: label.trim() || undefined,
      statuses,
      mediaTypes,
      favoritesOnly,
    });
    setSaving(false);
    if (message) setError(message);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="border border-tui-red bg-tui-red/10 p-3 text-tui-red">
          ERROR: {error}
        </p>
      )}

      {!lockSlug && (
        <div>
          <label
            htmlFor="share-handle"
            className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-tui-text-muted"
          >
            Handle
          </label>
          <div className="flex items-center border border-tui-border bg-tui-input focus-within:border-tui-text">
            <span className="pl-3 text-tui-text-muted">/share/</span>
            <input
              id="share-handle"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-picks"
              autoComplete="off"
              className="w-full bg-transparent py-2.5 pl-1 pr-3 text-tui-text placeholder:text-tui-text-muted focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-[10px] uppercase text-tui-text-muted">
            * Lowercase letters, numbers and hyphens. Anyone who guesses the
            handle can read the list — revoke it to cut access.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="share-label"
          className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-tui-text-muted"
        >
          Title (optional)
        </label>
        <input
          id="share-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          placeholder="WHAT VISITORS SEE AT THE TOP"
          className="w-full border border-tui-border bg-tui-input px-3 py-2.5 text-tui-text placeholder:text-tui-text-muted focus:border-tui-text focus:outline-none"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-tui-text-muted">
          Include statuses
        </legend>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={statuses.includes(opt.value)}
              onClick={() => setStatuses((s) => toggle(s, opt.value))}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-tui-text-muted">
          Include types
        </legend>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={mediaTypes.includes(opt.value)}
              onClick={() => setMediaTypes((t) => toggle(t, opt.value))}
            />
          ))}
        </div>
      </fieldset>

      <Chip
        label="Favorites only"
        active={favoritesOnly}
        onClick={() => setFavoritesOnly((v) => !v)}
      />

      <p className="text-[10px] uppercase text-tui-text-muted">
        * Select nothing to share everything. Notes are never shared.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="border border-tui-border bg-tui-panel px-6 py-2.5 font-bold uppercase text-tui-text transition-all hover:border-tui-text hover:bg-tui-input hover:text-tui-amber disabled:opacity-50"
        >
          {saving ? "SAVING..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border border-tui-border bg-tui-input px-6 py-2.5 uppercase text-tui-text-muted transition-all hover:text-tui-text"
          >
            [ CANCEL ]
          </button>
        )}
      </div>
    </form>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border px-3 py-1.5 text-[10px] uppercase tracking-wider transition-all ${
        active
          ? "border-tui-amber bg-tui-amber/10 text-tui-amber"
          : "border-tui-border bg-tui-input text-tui-text-muted hover:border-tui-text hover:text-tui-text"
      }`}
    >
      {label}
    </button>
  );
}
