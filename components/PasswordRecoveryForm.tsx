"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmPasswordReset, requestPasswordReset } from "@/app/actions/auth";

type State = { success?: boolean; error?: string };

export default function PasswordRecoveryForm({ reset = false }: { reset?: boolean }) {
  const [state, submit, pending] = useActionState<State, FormData>(async (previous, formData) => {
    if (!reset) return requestPasswordReset(previous, formData);

    const params = new URLSearchParams(window.location.hash.slice(1));
    formData.set("token", params.get("token") ?? "");
    const result = await confirmPasswordReset(formData);
    if (result.success) window.history.replaceState(null, "", window.location.pathname);
    return result;
  }, {});

  const inputClass = "w-full border-2 border-tui-border bg-tui-input px-3 py-2 text-tui-text focus:border-tui-amber focus:outline-none";

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-tui-bg p-4 text-tui-text">
      <section className="w-full max-w-md border-2 border-tui-border bg-tui-panel p-6 sm:p-8">
        <h1 className="mb-3 font-mono text-2xl font-bold">
          {reset ? "Choose a new password" : "Reset your password"}
        </h1>
        {state.success ? (
          <p role="status" className="mb-6">
            {reset
              ? "Your password was updated. Sign in with your new password."
              : "If the email matches an account, you’ll receive a reset link. Check your inbox and spam folder."}
          </p>
        ) : (
          <form action={submit} className="mb-6 space-y-4">
            {reset ? (
              <>
                <p id="password-rules" className="text-sm">
                  Use at least 8 characters and include a digit or special character.
                </p>
                <label className="block space-y-1">
                  <span>New password</span>
                  <input name="password" type="password" required minLength={8} autoComplete="new-password"
                    aria-describedby="password-rules" className={inputClass} />
                </label>
                <label className="block space-y-1">
                  <span>Confirm new password</span>
                  <input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password"
                    className={inputClass} />
                </label>
              </>
            ) : (
              <label className="block space-y-1">
                <span>Account email address</span>
                <input name="email" type="email" required autoComplete="email" className={inputClass} />
              </label>
            )}
            {state.error && <p role="alert" className="text-sm text-tui-red">{state.error}</p>}
            <button type="submit" disabled={pending}
              className="w-full border-2 border-tui-border px-4 py-2 font-mono font-bold hover:bg-tui-amber hover:text-tui-bg disabled:opacity-60">
              {pending ? "Please wait…" : reset ? "Update password" : "Send reset link"}
            </button>
          </form>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link href="/login" className="underline underline-offset-4">Back to sign in</Link>
          {reset && !state.success && <Link href="/forgot-password" className="underline underline-offset-4">Request a new link</Link>}
        </div>
      </section>
    </main>
  );
}
