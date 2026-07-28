"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, UserPlus, AlertCircle } from "lucide-react";
import { register } from "@/app/actions/auth";
import { useSession } from "@/components/SessionProvider";

export default function RegisterPage() {
    const router = useRouter();
    const { update, status } = useSession();
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

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
                    LUMIÈRE®
                </Link>
            </header>

            {/* Content */}
            <div className="auth-content">
                <div className="auth-card">
                    {/* Card header */}
                    <div className="auth-card-header">
                        <h1 className="auth-title">Create your account</h1>
                        <p className="auth-subtitle">
                            Start tracking your movies, TV shows, and anime
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
                            {/* Name */}
                            <div className="auth-field">
                                <label htmlFor="name" className="auth-label">
                                    NAME
                                </label>
                                <div className="auth-input-wrap">
                                    <User className="auth-input-icon" />
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        required
                                        autoComplete="name"
                                        placeholder="Your name"
                                        className="auth-input"
                                    />
                                </div>
                            </div>

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
                                        minLength={8}
                                        autoComplete="new-password"
                                        placeholder="Min. 8 characters"
                                        className="auth-input"
                                    />
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="auth-field">
                                <label htmlFor="confirmPassword" className="auth-label">
                                    CONFIRM PASSWORD
                                </label>
                                <div className="auth-input-wrap">
                                    <Lock className="auth-input-icon" />
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        placeholder="Repeat your password"
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
                                        <span>CREATING ACCOUNT...</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4" />
                                        <span>CREATE ACCOUNT</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Card footer */}
                    <div className="auth-footer">
                        <p className="auth-footer-text">
                            Already have an account?{" "}
                            <Link href="/login" className="auth-footer-link">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
