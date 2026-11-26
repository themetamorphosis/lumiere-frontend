"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, AlertTriangle, Terminal } from "lucide-react";
import { motion } from "framer-motion";
import { login } from "@/app/actions/auth";
import { useSession } from "@/components/SessionProvider";
import { useRetroTheme } from "@/components/layout/RetroThemeContext";

export default function LoginPage() {
    const router = useRouter();
    const { update } = useSession();
    const { theme, scanlines } = useRetroTheme();
    const [mounted, setMounted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);
    const isRetro = mounted && theme.startsWith("retro");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setIsPending(true);
        const res = await login(null, new FormData(e.currentTarget));
        if (res?.error) {
            setError(res.error);
            setIsPending(false);
        } else if (res?.success) {
            await update();
            router.refresh();

            const params = new URLSearchParams(window.location.search);
            const callbackUrl = params.get("callbackUrl");
            if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") && !callbackUrl.includes("\\")) {
                router.push(callbackUrl);
            } else {
                router.push("/dashboard");
            }
        }
    };

    return (
        <main id="main-content" tabIndex={-1} className={`min-h-screen flex flex-col justify-center items-center p-4 relative bg-tui-bg text-tui-text ${isRetro ? `retro-container ${scanlines ? "retro-scanlines" : ""}` : "font-sans"}`}>
            
            <div className="absolute top-6 left-6 z-20">
                <Link href="/" className="text-xl font-mono font-bold tracking-widest text-tui-text hover:text-tui-amber transition-colors flex items-center gap-2 uppercase">
                    <Terminal className="h-5 w-5" />
                    [LUMIÈRE_SYS]
                </Link>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-md bg-tui-panel border-2 border-tui-border p-8 relative z-10 shadow-[8px_8px_0_rgba(0,0,0,0.5)]"
            >
                {/* Header */}
                <div className="text-center mb-8 border-b-2 border-tui-border pb-6">
                    <h1 className="text-2xl font-mono font-bold text-tui-text tracking-widest uppercase mb-2">
                        Sign in
                    </h1>
                </div>

                {/* Error message */}
                {error && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        role="alert"
                        className="mb-6 flex items-start gap-3 border border-tui-red bg-tui-panel p-3"
                    >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-tui-red mt-0.5" />
                        <span className="text-xs font-mono text-tui-red uppercase tracking-wide leading-relaxed">
                            {error}
                        </span>
                    </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email */}
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-xs font-mono text-tui-text-muted uppercase tracking-widest block">
                            Email address
                        </label>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tui-text-muted transition-colors group-focus-within:text-tui-amber" />
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="you@example.com"
                                className="w-full bg-tui-input border-2 border-tui-border-muted rounded-none py-3 pl-10 pr-4 text-sm text-tui-text placeholder-tui-text-muted/50 focus:outline-none focus:border-tui-amber focus:text-tui-amber transition-colors font-mono"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-xs font-mono text-tui-text-muted uppercase tracking-widest block">
                            Password
                        </label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tui-text-muted transition-colors group-focus-within:text-tui-amber" />
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="w-full bg-tui-input border-2 border-tui-border-muted rounded-none py-3 pl-10 pr-4 text-sm text-tui-text placeholder-tui-text-muted/50 focus:outline-none focus:border-tui-amber focus:text-tui-amber transition-colors font-mono"
                            />
                        </div>
                    </div>

                    <Link href="/forgot-password" className="inline-block text-sm text-tui-text underline underline-offset-4">
                        Forgot your password?
                    </Link>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full px-4 py-3.5 mt-8 bg-tui-bg border-2 border-tui-border hover:bg-tui-amber hover:text-tui-bg hover:border-tui-amber text-xs font-mono font-bold text-tui-text uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {isPending ? (
                            <>
                                <span className="animate-pulse">Signing in…</span>
                            </>
                        ) : (
                            <>
                                <LogIn className="h-4 w-4" />
                                <span>Sign in</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t-2 border-tui-border text-center">
                    <p className="text-xs font-mono text-tui-text-muted uppercase tracking-widest flex items-center justify-center gap-2 flex-wrap">
                        <span>New to Lumière?</span>
                        <Link href="/register" className="text-tui-text hover:text-tui-amber font-bold transition-colors">
                            Create an account
                        </Link>
                    </p>
                </div>
            </motion.div>
        </main>
    );
}
