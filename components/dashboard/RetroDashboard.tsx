"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";
import type { DashboardStats } from "@/hooks/useDashboardStats";
import type { Item } from "@/lib/types";
import TmdbSearchInput from "@/components/TmdbSearchInput";
import type { TMDBSearchResult } from "@/lib/tmdb";
import { useRetroTheme } from "@/components/layout/RetroThemeContext";

interface RetroDashboardProps {
  greeting: string;
  userName: string;
  userEmail: string;
  stats: DashboardStats;
  activeSpotlight: Item | null;
  onQuickAdd: (result: TMDBSearchResult) => void;
  toast: string | null;
}

export default function RetroDashboard({
  greeting,
  userName,
  userEmail,
  stats,
  activeSpotlight,
  onQuickAdd,
  toast,
}: RetroDashboardProps) {
  const { theme } = useRetroTheme();
  const lpThemeClass = theme === "retro-light" ? "theme-light" : "theme-dark";

  return (
    <div className={`lp ${lpThemeClass} db-frame`}>
      {/* ━━━ HEADER ━━━ */}
      <div className="db-header">
        <div className="db-header-left">
          <h1 className="db-greeting">
            {greeting},<br />
            {userName}
          </h1>
          <div className="db-user-email">{userEmail}</div>
        </div>
        <div className="db-header-right">
          <div className="lp-label mb-2 px-0">SYSTEM BUILD: 2.21</div>
          <div className="lp-label mb-2 px-0 text-emerald-500">
            STATUS: ONLINE
          </div>
          <Link
            href="/profile"
            className="lp-view-link mt-4"
            style={{ padding: "12px", justifyContent: "center" }}
          >
            EDIT PROFILE
          </Link>
        </div>
      </div>

      {/* ━━━ STATS GRID ━━━ */}
      <div className="db-stats-grid">
        <div className="db-stat-cell">
          <div className="lp-label px-0">DIRECTORY SIZE</div>
          <div className="db-stat-number">
            {stats.totalStatus.toString().padStart(2, "0")}
          </div>
          <div className="text-xs text-tui-text-muted mt-2 uppercase tracking-widest font-mono">
            {stats.counts.movie} MOVIES | {stats.counts.tv} TV
          </div>
        </div>
        <div className="db-stat-cell">
          <div className="lp-label px-0">HOURS CONSUMED</div>
          <div className="db-stat-number">
            {stats.hoursWatched.toString().padStart(2, "0")}
          </div>
          <div className="text-xs text-tui-text-muted mt-2 uppercase tracking-widest font-mono">
            AVG {stats.avgWatchedRuntime} MIN / TITLE
          </div>
        </div>
        <div className="db-stat-cell">
          <div className="lp-label px-0">SPOTLIGHT PICKS</div>
          <div className="db-stat-number">
            {stats.counts.favorites.toString().padStart(2, "0")}
          </div>
          <div className="text-xs text-tui-text-muted mt-2 uppercase tracking-widest font-mono">
            TOP GENRE: {stats.topGenre || "N/A"}
          </div>
        </div>
        <div className="db-stat-cell">
          <div className="lp-label px-0">COMPLETION RATIO</div>
          <div className="db-stat-number">
            {stats.completionRate.toString().padStart(2, "0")}%
          </div>
          <div className="text-xs text-tui-text-muted mt-2 uppercase tracking-widest font-mono">
            {stats.watchedCount} OF {stats.totalStatus} CATALOGED
          </div>
        </div>
      </div>

      {/* ━━━ CONTENT GRID ━━━ */}
      <div className="db-content-grid">
        <div className="db-col-left">
          {/* Spotlight */}
          <div className="db-panel">
            <div className="lp-label px-0">SPOTLIGHT PICK</div>
            {activeSpotlight ? (
              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start mt-4">
                {activeSpotlight.coverUrl ? (
                  <div className="w-full md:w-1/2 max-w-[300px] shrink-0 border border-[var(--lp-border)]">
                    <img
                      src={activeSpotlight.coverUrl}
                      alt={activeSpotlight.title}
                      className="w-full h-auto object-cover grayscale hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                ) : (
                  <div className="w-full md:w-1/2 max-w-[300px] aspect-[2/3] border border-[var(--lp-border)] flex items-center justify-center text-tui-text-muted font-mono text-xs">
                    NO IMAGE
                  </div>
                )}
                <div className="flex-1 flex flex-col pt-4">
                  <div className="db-greeting" style={{ fontSize: "clamp(32px, 5vw, 48px)", marginBottom: "8px" }}>
                    {activeSpotlight.title}
                  </div>
                  <div className="text-sm text-tui-text-muted font-mono uppercase tracking-widest mb-6">
                    {activeSpotlight.mediaType} | {activeSpotlight.year || "N/A"}
                  </div>
                  <p className="text-sm text-tui-text-muted leading-relaxed max-w-md line-clamp-6">
                    {activeSpotlight.description || "No description available."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-sm text-tui-text-muted font-mono uppercase mt-4">
                No spotlight pick available.
              </div>
            )}
          </div>

          {/* Favorites */}
          <div className="db-panel" style={{ borderBottom: "none" }}>
            <div className="lp-label px-0">FAVORITES DIRECTORY</div>
            {stats.favoritesList.length > 0 ? (
              <div className="flex overflow-x-auto gap-4 pb-4 mt-4 scrollbar-hide">
                {stats.favoritesList.map((item) => (
                  <div
                    key={item.id}
                    className="w-[120px] shrink-0 border border-[var(--lp-border)]"
                  >
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="w-full aspect-[2/3] object-cover grayscale hover:grayscale-0 transition-all duration-300"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-tui-input flex items-center justify-center text-[10px] text-tui-text-muted font-mono">
                        N/A
                      </div>
                    )}
                    <div className="p-3 text-[10px] text-tui-text-muted font-mono uppercase truncate text-center">
                      {item.title}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-tui-text-muted font-mono uppercase mt-4">
                No favorites
              </div>
            )}
          </div>
        </div>

        <div className="db-col-right">
          {/* Quick Add */}
          <div className="db-panel">
            <div className="lp-label px-0">QUICK ADD</div>
            <div className="mt-4">
              <TmdbSearchInput
                mediaType="movie"
                onSelect={onQuickAdd}
                placeholder="SEARCH TMDB TO CATALOG..."
              />
            </div>
            <p className="text-xs text-tui-text-muted mt-6 font-mono leading-relaxed">
              Instantly track new media in your directory.
            </p>
          </div>

          {/* Recent Activity */}
          <div className="db-panel" style={{ borderBottom: "none" }}>
            <div className="lp-label px-0">RECENT TRANSACTIONS</div>
            <div className="mt-4 space-y-0">
              {stats.activityLogs.slice(0, 6).map((log, idx) => (
                <div
                  key={log.id + idx}
                  className="flex items-center gap-4 py-4 border-b border-[var(--lp-border)] text-xs font-mono text-tui-text-muted last:border-b-0"
                >
                  <span className="w-12 shrink-0">{log.time}</span>
                  <span className="text-[var(--lp-text)] font-bold w-16 shrink-0 uppercase">
                    {log.action}
                  </span>
                  <span className="truncate flex-1">{log.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 24, x: "-50%" }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 z-50 px-6 py-4 bg-[var(--lp-bg-card)] border border-[var(--lp-border)] shadow-2xl text-xs font-mono uppercase flex items-center gap-3"
          >
            <CheckCircle className="h-4 w-4" style={{ color: "var(--lp-text)" }} />
            <span style={{ color: "var(--lp-text)" }}>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

