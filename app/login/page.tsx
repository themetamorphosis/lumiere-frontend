"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";
import { login } from "@/app/actions/auth";
import { useSession } from "@/components/SessionProvider";

export default function LoginPage() {
    const router = useRouter();
    const { update } = useSession();
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
        update();
    }, [update]);

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
            if (callbackUrl && callbackUrl.startsWith("/")) {
                router.push(callbackUrl);
            } else {
                router.push("/dashboard");
            }
        }
    };

    const [theme, setTheme] = useState("dark");

    useEffect(() => {
        const saved = localStorage.getItem("wv-landing-theme");
        if (saved === "light" || saved === "dark") {
            setTheme(saved);
        } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
            setTheme("light");
        }
    }, []);

    return (
        <div className={`auth-page theme-${theme}`}>
            <div className="auth-noise" />

            {/* Header */}
            <header className="auth-header">
                <Link href="/" className="auth-logo">
                    WATCHVAULT®
                </Link>
            </header>

            {/* Content */}
            <div className="auth-content">
                <div className="auth-card">
                    {/* Card header */}
                    <div className="auth-card-header">
                        <h1 className="auth-title">Welcome back</h1>
                        <p className="auth-subtitle">
                            Sign in to your account to continue
                        </p>
                    </div>

                    {/* Card body */}
                    <div className="auth-card-body">
                        {/* Error */}
                        {error && (
                            <div className="auth-error">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {/* Email */}
                            <div className="auth-field">
                                <label htmlFor="email" className="auth-label">
                                    EMAIL
                                </label>
                                <div className="auth-input-wrap">
                                    <Mail className="auth-input-icon" />
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        className="auth-input"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="auth-field">
                                <label htmlFor="password" className="auth-label">
                                    PASSWORD
                                </label>
                                <div className="auth-input-wrap">
                                    <Lock className="auth-input-icon" />
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                        className="auth-input"
                                    />
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isPending}
                                className="auth-submit"
                            >
                                {isPending ? (
                                    <>
                                        <div className="auth-spinner" />
                                        <span>SIGNING IN...</span>
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="h-4 w-4" />
                                        <span>SIGN IN</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Card footer */}
                    <div className="auth-footer">
                        <p className="auth-footer-text">
                            Don&apos;t have an account?{" "}
                            <Link href="/register" className="auth-footer-link">
                                Create one
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
