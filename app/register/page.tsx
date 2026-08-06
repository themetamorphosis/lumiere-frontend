"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, UserPlus, AlertTriangle, Terminal, User } from "lucide-react";
import { motion } from "framer-motion";
import { register } from "@/app/actions/auth";
import { useSession } from "@/components/SessionProvider";
import { useRetroTheme } from "@/components/layout/RetroThemeContext";

export default function RegisterPage() {
    const router = useRouter();
    const { update, status } = useSession();
    const { theme, scanlines } = useRetroTheme();
    const [mounted, setMounted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);
    const isRetro = mounted && theme.startsWith("retro");

    useEffect(() => {
        if (status === "authenticated") {
            router.replace("/dashboard");
        }
    }, [status, router]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setIsPending(true);
        const res = await register(null, new FormData(e.currentTarget));
        if (res?.error) {
            setError(res.error);
            setIsPending(false);
        } else if (res?.success) {
            await update();
            router.refresh();
            router.push("/dashboard");
        }
    };

    return (
        <div className={`min-h-screen flex flex-col justify-center items-center p-4 relative bg-tui-bg text-tui-text ${isRetro ? `retro-container ${scanlines ? "retro-scanlines" : ""}` : "font-sans"}`}>
            
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
                className="w-full max-w-md bg-tui-panel border-2 border-tui-border p-8 relative z-10 shadow-[8px_8px_0_rgba(0,0,0,0.5)] my-12"
            >
                {/* Header */}
                <div className="text-center mb-8 border-b-2 border-tui-border pb-6">
                    <h1 className="text-2xl font-mono font-bold text-tui-text tracking-widest uppercase mb-2">
                        REG_NEW_NODE
                    </h1>
                    <p className="text-xs font-mono text-tui-text-muted uppercase tracking-widest">
                        System Initialization
                    </p>
                </div>

                {/* Error message */}
                {error && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="mb-6 p-3 bg-red-950/40 border-2 border-red-900 flex items-start gap-3"
                    >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                        <span className="text-xs font-mono text-red-400 uppercase tracking-wide leading-relaxed">
                            {error}
                        </span>
                    </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div className="space-y-2">
                        <label htmlFor="name" className="text-xs font-mono text-tui-text-muted uppercase tracking-widest block">
                            {'>'} IDENTIFIER
                        </label>
                        <div className="relative group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tui-text-muted transition-colors group-focus-within:text-tui-amber" />
                            <input
                                id="name"
                                name="name"
                                type="text"
                                required
                                autoComplete="name"
                                placeholder="GUEST_1337"
                                className="w-full bg-tui-input border-2 border-tui-border-muted rounded-none py-3 pl-10 pr-4 text-sm text-tui-text placeholder-tui-text-muted/50 focus:outline-none focus:border-tui-amber focus:text-tui-amber transition-colors font-mono uppercase"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-xs font-mono text-tui-text-muted uppercase tracking-widest block">
                            {'>'} COMM_LINK
                        </label>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tui-text-muted transition-colors group-focus-within:text-tui-amber" />
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="USER@NODE.LOCAL"
                                className="w-full bg-tui-input border-2 border-tui-border-muted rounded-none py-3 pl-10 pr-4 text-sm text-tui-text placeholder-tui-text-muted/50 focus:outline-none focus:border-tui-amber focus:text-tui-amber transition-colors font-mono uppercase"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-xs font-mono text-tui-text-muted uppercase tracking-widest block">
                            {'>'} SECURITY_KEY
                        </label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tui-text-muted transition-colors group-focus-within:text-tui-amber" />
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                className="w-full bg-tui-input border-2 border-tui-border-muted rounded-none py-3 pl-10 pr-4 text-sm text-tui-text placeholder-tui-text-muted/50 focus:outline-none focus:border-tui-amber focus:text-tui-amber transition-colors font-mono"
                            />
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="text-xs font-mono text-tui-text-muted uppercase tracking-widest block">
                            {'>'} CONFIRM_KEY
                        </label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tui-text-muted transition-colors group-focus-within:text-tui-amber" />
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                className="w-full bg-tui-input border-2 border-tui-border-muted rounded-none py-3 pl-10 pr-4 text-sm text-tui-text placeholder-tui-text-muted/50 focus:outline-none focus:border-tui-amber focus:text-tui-amber transition-colors font-mono"
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full px-4 py-3.5 mt-8 bg-tui-bg border-2 border-tui-border hover:bg-tui-amber hover:text-tui-bg hover:border-tui-amber text-xs font-mono font-bold text-tui-text uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {isPending ? (
                            <>
                                <span className="animate-pulse">[ PROCESSING... ]</span>
                            </>
                        ) : (
                            <>
                                <UserPlus className="h-4 w-4" />
                                <span>[ EXECUTE_REGISTER ]</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t-2 border-tui-border text-center">
                    <p className="text-xs font-mono text-tui-text-muted uppercase tracking-widest flex items-center justify-center gap-2 flex-wrap">
                        <span>NODE ESTABLISHED?</span>
                        <Link href="/login" className="text-tui-text hover:text-tui-amber font-bold transition-colors">
                            [ AUTH_LOGIN ]
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
