import Link from "next/link";

/**
 * A revoked link is the expected way this page 404s, so it gets a message that
 * explains that rather than the generic "Page not found".
 */
export default function ShareNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-tui-bg px-6 text-tui-text">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-tui-text-muted">
          Lumière
        </p>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          This watchlist isn&apos;t available
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-tui-text-muted">
          The link may have been revoked by its owner, or the handle may never
          have existed.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block border border-tui-border bg-tui-input px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-tui-text-muted transition-colors hover:border-tui-text hover:text-tui-text"
        >
          Go to Lumière
        </Link>
      </div>
    </div>
  );
}
