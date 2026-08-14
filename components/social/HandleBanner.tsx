"use client";

import { useState } from "react";
import Link from "next/link";
import { AtSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { claimHandle } from "@/app/actions/social";
import { useSession } from "@/components/SessionProvider";
import { SESSION_EXPIRED } from "@/lib/apiError";

/**
 * Prompt to claim a handle.
 *
 * Not a gate: you can add friends and chat without one. But nobody can find
 * *you* until you have one, so an account with no handle is invisible to
 * search — which looks like the feature being broken rather than a setting
 * left unset.
 */
export default function HandleBanner() {
  const { data: session, update } = useSession();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session?.user?.handle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await claimHandle(value);
    setSaving(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    await update();
    toast.success(`You're @${res.handle}`);
  };

  return (
    <div className="border border-tui-amber/40 bg-tui-amber/5 p-4">
      <div className="flex items-start gap-3">
        <AtSign className="mt-0.5 h-4 w-4 shrink-0 text-tui-amber" />
        <div className="flex-1">
          <h2 className="text-sm font-medium text-tui-text">
            Claim your handle
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-tui-text-muted">
            Friends find you by handle. Until you pick one, nobody can send you
            a request.
          </p>

          <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap gap-2">
            <div className="flex flex-1 items-center border border-tui-border bg-tui-input focus-within:border-tui-amber">
              <span className="pl-3 font-mono text-sm text-tui-text-muted">
                @
              </span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="yourname"
                aria-label="Choose a handle"
                autoComplete="off"
                className="w-full bg-transparent py-2 pl-0.5 pr-3 text-sm text-tui-text placeholder:text-tui-text-muted/40 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={saving || value.trim().length < 3}
              className="flex items-center gap-2 border border-tui-border bg-tui-panel px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-tui-text transition-colors hover:border-tui-amber hover:text-tui-amber disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Claim
            </button>
          </form>

          {error && (
            <p className="mt-2 font-mono text-[11px] uppercase text-tui-red">
              {error}
              {/* A dead session isn't something you can fix by editing the
                  field, so the message carries the way out. */}
              {error === SESSION_EXPIRED && (
                <>
                  {" "}
                  <Link
                    href="/login"
                    className="underline hover:text-tui-amber"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
