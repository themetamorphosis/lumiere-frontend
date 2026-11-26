"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession, signOut } from "@/components/SessionProvider";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AtSign,
  User,
  Mail,
  Camera,
  Check,
  Loader2,
  Upload,
} from "lucide-react";
import { updateProfile, uploadAvatar } from "@/app/actions/profile";
import AppShell from "@/components/layout/AppShell";
import ShareLinksPanel from "@/components/profile/ShareLinksPanel";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, update: updateSession, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState<string>("");
  const [showSaved, setShowSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.image) {
      setImagePreview(session.user.image);
      setImageUrlInput(session.user.image);
    }
  }, [session?.user?.image]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const res = await updateProfile(null, new FormData(e.currentTarget));
    if (res?.error) {
      setError(res.error);
    } else if (res?.success) {
      setShowSaved(true);
      await updateSession();
      setTimeout(() => setShowSaved(false), 2500);
    }
    setIsPending(false);
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setImageUrlInput(url);
    const trimmed = url.trim();
    if (trimmed) {
      if (trimmed.startsWith("/")) {
        setImagePreview(trimmed);
      } else {
        try {
          new URL(trimmed);
          setImagePreview(trimmed);
        } catch {
          setImagePreview(null);
        }
      }
    } else {
      setImagePreview(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadAvatar(formData);

      if (res.error) {
        setUploadError(res.error);
        return;
      }

      setImagePreview(res.imageUrl!);
      setImageUrlInput(res.imageUrl!);
      await updateSession();
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2500);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!session) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-tui-bg flex items-center justify-center font-mono">
        <span role="status" className="sr-only">Loading profile</span>
        <Loader2 className="h-8 w-8 text-tui-text-muted animate-spin" />
      </main>
    );
  }

  return (
    <AppShell>
      <div className="relative z-10 mx-auto w-full max-w-[800px] px-6 pt-12 pb-20 font-mono text-xs text-tui-text">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-mono text-tui-text-muted hover:text-tui-text transition-colors uppercase mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />[ BACK TO DASHBOARD ]
          </Link>

          <h1 className="text-2xl font-bold uppercase tracking-wider mb-2 text-tui-text">
            Profile Settings
          </h1>
          <p className="text-tui-text-muted uppercase mb-10">
            [ MANAGE YOUR ACCOUNT DIRECTORY ]
          </p>

          {/* Profile card */}
          <div className="border border-tui-border bg-tui-panel p-8 mb-6 relative">
            {/* Accent Bar */}
            <div className="h-1 bg-tui-amber absolute left-0 right-0 top-0" />

            {/* Avatar with upload */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 mt-2">
              <div className="relative group">
                <div className="h-24 w-24 border border-tui-border bg-tui-input overflow-hidden">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      onError={() => setImagePreview(null)}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-tui-input text-tui-text-muted">
                      <span className="text-3xl font-bold font-mono">
                        {session.user?.name?.[0]?.toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                </div>
                {/* Upload overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Upload profile photo"
                  className="touch-visible absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer border-0"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <div>
                <h3 className="font-bold text-tui-text uppercase mb-1">
                  USER AVATAR
                </h3>
                <p className="text-[10px] text-tui-text-muted uppercase mb-3">
                  [ CLICK AVATAR BOX TO UPLOAD NEW IMAGE ]
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 border border-tui-border bg-tui-input text-[10px] text-tui-text-muted hover:border-tui-text hover:text-tui-text transition-all uppercase cursor-pointer"
                >
                  {uploading ? "Uploading..." : "Select File"}
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Upload error */}
              {uploadError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border border-tui-red bg-tui-red/10 text-tui-red uppercase font-mono text-xs"
                >
                  ERROR: {uploadError}
                </motion.div>
              )}

              {/* Form error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border border-tui-red bg-tui-red/10 text-tui-red uppercase font-mono text-xs"
                >
                  ERROR: {error}
                </motion.div>
              )}

              {/* Success */}
              {showSaved && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 border border-tui-green bg-tui-green/10 text-tui-green uppercase font-mono text-xs flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  SUCCESS: PROFILE UPDATED SUCCESSFULLY
                </motion.div>
              )}

              <div className="space-y-5">
                {/* Name */}
                <div>
                  <label htmlFor="profile-name" className="block text-[10px] font-bold text-tui-text-muted uppercase mb-2 tracking-wider">
                    DISPLAY NAME
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-tui-text-muted" />
                    <input
                      id="profile-name"
                      type="text"
                      name="name"
                      defaultValue={session.user?.name || ""}
                      placeholder="YOUR NAME"
                      className="w-full pl-11 pr-4 py-2.5 bg-tui-input border border-tui-border text-tui-text placeholder:text-tui-text-muted focus:border-tui-text focus:bg-tui-input outline-none transition-all uppercase"
                    />
                  </div>
                </div>

                {/* Handle — how friends find you in /social */}
                <div>
                  <label htmlFor="profile-handle" className="block text-[10px] font-bold text-tui-text-muted uppercase mb-2 tracking-wider">
                    HANDLE
                  </label>
                  <div className="relative flex items-center bg-tui-input border border-tui-border focus-within:border-tui-text">
                    <AtSign className="ml-3.5 h-4 w-4 text-tui-text-muted shrink-0" />
                    <input
                      id="profile-handle"
                      type="text"
                      name="handle"
                      defaultValue={session.user?.handle || ""}
                      placeholder="yourname"
                      autoComplete="off"
                      className="w-full pl-2 pr-4 py-2.5 bg-transparent text-tui-text placeholder:text-tui-text-muted outline-none transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-tui-text-muted uppercase mt-1.5">
                    * Friends find you by handle. Lowercase letters, numbers and
                    underscores
                  </p>
                </div>

                {/* Email (read-only) */}
                <div>
                  <label htmlFor="profile-email" className="block text-[10px] font-bold text-tui-text-muted uppercase mb-2 tracking-wider">
                    EMAIL ADDRESS
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-tui-text-muted" />
                    <input
                      id="profile-email"
                      type="email"
                      value={session.user?.email || ""}
                      readOnly
                      className="w-full pl-11 pr-4 py-2.5 bg-tui-input/40 border border-tui-border/50 text-tui-text-muted"
                    />
                  </div>
                  <p className="text-[10px] text-tui-text-muted uppercase mt-1.5">
                    * Email address is read-only and cannot be altered
                  </p>
                </div>

                {/* Profile Image URL — alternative to upload */}
                <div>
                  <label htmlFor="profile-image" className="block text-[10px] font-bold text-tui-text-muted uppercase mb-2 tracking-wider">
                    Photo URL
                  </label>
                  <div className="relative">
                    <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-tui-text-muted" />
                    <input
                      id="profile-image"
                      type="text"
                      name="image"
                      value={imageUrlInput}
                      placeholder="HTTPS://EXAMPLE.COM/PHOTO.JPG"
                      onChange={handleImageUrlChange}
                      className="w-full pl-11 pr-4 py-2.5 bg-tui-input border border-tui-border text-tui-text placeholder:text-tui-text-muted focus:border-tui-text focus:bg-tui-input outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <motion.button
                type="submit"
                disabled={isPending}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto px-6 py-2.5 border border-tui-border bg-tui-panel text-tui-text hover:border-tui-text hover:text-tui-amber hover:bg-tui-input transition-all uppercase font-bold cursor-pointer"
              >
                {isPending ? "SAVING CHANGES..." : "[ SAVE CHANGES ]"}
              </motion.button>
            </form>
          </div>

          {/* Public share links */}
          <ShareLinksPanel />

          {/* Account info */}
          <div className="border border-tui-border bg-tui-panel p-6 relative">
            <div className="h-1 bg-tui-red absolute left-0 right-0 top-0" />
            <h3 className="text-[10px] font-bold text-tui-text-muted uppercase tracking-wider mb-4">
              SYSTEM ACCOUNT DETAILS
            </h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div>
                <div className="text-tui-text-muted uppercase">
                  SIGNED IN AS:{" "}
                  <span className="font-bold text-tui-text">
                    {session.user?.email}
                  </span>
                </div>
                <div className="text-[10px] text-tui-text-muted uppercase mt-1">
                  MEMBER DIRECTORY CREATED:{" "}
                  {new Date()
                    .toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                    .toUpperCase()}
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="px-4 py-2 border border-tui-border bg-tui-input text-tui-red hover:border-tui-red hover:bg-tui-red/15 transition-all duration-200 uppercase font-bold cursor-pointer"
              >
                [ SIGN OUT SESSION ]
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
