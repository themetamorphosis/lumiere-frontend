"use client";

import type { PublicUser } from "@/lib/types";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

export function displayName(user: PublicUser): string {
  return user.name?.trim() || (user.handle ? `@${user.handle}` : "Someone");
}

/**
 * A user's avatar, falling back to their initial.
 *
 * Plain <img> because the source is whatever URL that user set, and
 * next/image only accepts hosts listed in next.config's remotePatterns.
 * Relative `/uploads/...` paths are skipped: they're served by the backend
 * origin and would 404 here.
 */
export default function Avatar({
  user,
  size = "md",
}: {
  user: PublicUser;
  size?: keyof typeof SIZES;
}) {
  const usable =
    user.image && /^https?:\/\//.test(user.image) ? user.image : null;
  const name = displayName(user);

  if (usable) {
    return (
      <img
        src={usable}
        alt=""
        className={`${SIZES[size]} shrink-0 border border-tui-border object-cover`}
      />
    );
  }

  return (
    <div
      className={`${SIZES[size]} flex shrink-0 items-center justify-center border border-tui-border bg-tui-input font-mono text-tui-text-muted`}
      aria-hidden="true"
    >
      {name.replace("@", "")[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
