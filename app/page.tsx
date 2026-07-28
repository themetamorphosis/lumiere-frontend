"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/components/SessionProvider";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowUpRight, Menu, X, Sun, Moon } from "lucide-react";

/* ─── SCROLL REVEAL COMPONENT ─── */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const FEATURES = [
  { num: "01", title: "SMART TRACKING" },
  { num: "02", title: "TMDB INTEGRATION" },
  { num: "03", title: "CUSTOM LISTS" },
  { num: "04", title: "NO ALGORITHMS" },
];

const LISTS = [
  { num: "01", label: "WATCHED", desc: "Your personal hall of fame." },
  { num: "02", label: "PENDING", desc: "Currently watching." },
  { num: "03", label: "WISHLIST", desc: "Saved for later." },
  { num: "04", label: "FAVORITES", desc: "All-time greats." },
];

export default function LandingPage() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [theme, setTheme] = useState("dark"); // "dark" or "light"
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    // Basic live clock
    const updateTime = () => {
      setTimeStr(new Date().toLocaleTimeString("en-US", { hour12: false }));
    };
    updateTime();
    const int = setInterval(updateTime, 1000);
    return () => clearInterval(int);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className={`lp ${theme === "light" ? "theme-light" : "theme-dark"}`}>
      <div className="lp-frame">
        {/* Noise */}
        <div className="lp-noise" />

        {/* ━━━ HEADER ━━━ */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="lp-header"
        >
          <div className="lp-header-inner">
            <div className="lp-header-left">
              <Link href="/" className="lp-logo">
                WATCHVAULT®
              </Link>
              <button
                onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                className="flex items-center justify-center w-8 h-8 border border-[var(--lp-border)] text-[var(--lp-text)] hover:bg-[var(--lp-text)] hover:text-[var(--lp-bg)] transition-colors"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>

            <nav className="lp-nav">
              {[
                { label: "FEATURES", id: "features" },
                { label: "LISTS", id: "lists" },
                { label: "ABOUT", id: "about" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="lp-nav-cell"
                >
                  {item.label}
                </button>
              ))}
              {session ? (
                <Link href="/dashboard" className="lp-nav-cell">
                  DASHBOARD
                </Link>
              ) : (
                <Link href="/login" className="lp-nav-cell">
                  LOG IN
                </Link>
              )}
            </nav>

            <button
              className="lp-mobile-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </motion.header>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lp-mobile-menu"
            >
              {["FEATURES", "LISTS", "ABOUT"].map((label) => (
                <button
                  key={label}
                  onClick={() => scrollToSection(label.toLowerCase())}
                  className="lp-mobile-link"
                >
                  {label}
                </button>
              ))}
              <div className="lp-divider-h" />
              {session ? (
                <Link href="/dashboard" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  DASHBOARD
                </Link>
              ) : (
                <>
                  <Link href="/login" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>LOG IN</Link>
                  <Link href="/register" className="lp-mobile-link lp-mobile-link--cta" onClick={() => setMobileMenuOpen(false)}>
                    GET STARTED →
                  </Link>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ━━━ HERO ━━━ */}
        <section className="lp-hero">
          <div className="lp-container">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="lp-hero-infobar"
            >
              <div className="lp-hero-infobar-left">
                <span className="lp-dot" />
                <span>A PERSONAL MEDIA<br />TRACKING PLATFORM</span>
              </div>
              <div className="lp-hero-infobar-right">
                <div className="lp-hero-meta-cell">
                  <span className="lp-meta-label">BUILT WITH</span>
                  <span className="lp-meta-value">NEXT.JS + FASTAPI</span>
                </div>
                <div className="lp-hero-meta-cell">
                  <span className="lp-meta-label">AVAILABLE</span>
                  <span className="lp-meta-value">WORLDWIDE</span>
                </div>
                <div className="lp-hero-meta-cell lp-hero-meta-cell--clock">
                  <span className="lp-dot" />
                  <span>{timeStr || "00:00:00"}</span>
                </div>
              </div>
            </motion.div>

            <div className="lp-hero-main">
              <motion.div
                className="lp-hero-left"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <h1 className="lp-headline">
                  TRACK<br />EVERY<br />THING.
                </h1>
              </motion.div>

              <motion.div
                className="lp-hero-right"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.6 }}
              >
                <p className="lp-hero-desc">
                  Movies, TV series and anime — organized
                  by watched, pending, wishlist and
                  favorites. Your personal media library,
                  clean and fast.
                </p>
                <Link
                  href={session ? "/dashboard" : "/register"}
                  className="lp-cta"
                >
                  <span>{session ? "OPEN DASHBOARD" : "START TRACKING"}</span>
                  <ArrowUpRight className="h-5 w-5" />
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ━━━ FEATURES ━━━ */}
        <section id="features" className="lp-features-section">
          <div className="lp-container">
            <div className="lp-features-grid">
              <div className="lp-features-left">
                <Reveal>
                  <div className="lp-label">
                    <span className="lp-dot" />
                    <span>WHAT WE OFFER</span>
                  </div>
                </Reveal>
                <div className="lp-feature-list">
                  {FEATURES.map((f, i) => (
                    <Reveal key={f.num} delay={0.04 * i}>
                      <div
                        className={`lp-feature-row ${hoveredFeature === i ? "lp-feature-row--active" : ""}`}
                        onMouseEnter={() => setHoveredFeature(i)}
                        onMouseLeave={() => setHoveredFeature(null)}
                      >
                        <span className="lp-feature-num">{f.num}</span>
                        <span className="lp-feature-title">{f.title}</span>
                        <ArrowUpRight className="lp-feature-arrow" />
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>

              <div className="lp-features-right">
                <Reveal>
                  <h2 className="lp-statement">
                    YOUR MEDIA LIBRARY<br />
                    ISN&apos;T JUST A LIST.<br />
                    <span className="lp-statement--muted">IT&apos;S A JOURNEY.</span>
                  </h2>
                </Reveal>
                <Reveal delay={0.1}>
                  <div className="lp-cinema-image">
                    <Image
                      src="/landing-cinema.png"
                      alt="Vintage cinema theater"
                      width={600}
                      height={400}
                      className="lp-cinema-img"
                      priority
                    />
                  </div>
                </Reveal>
                <Reveal delay={0.15}>
                  <Link
                    href={session ? "/dashboard" : "/register"}
                    className="lp-view-link"
                  >
                    <span>VIEW YOUR LIBRARY</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ LISTS — 4 COLUMNS ━━━ */}
        <section id="lists" className="lp-lists-section">
          <div className="lp-container">
            <div className="lp-lists-header">
              <span className="lp-dot" />
              <span>ORGANIZE YOUR WAY</span>
            </div>
            <div className="lp-lists-grid-4">
              {LISTS.map((list, i) => (
                <Reveal key={list.label} delay={0.06 * i} className="h-full">
                  <div className="lp-list-col h-full">
                    <div className="lp-list-num">{list.num}</div>
                    <div className="lp-list-title">{list.label}</div>
                    <div className="lp-list-desc">{list.desc}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━ ABOUT ━━━ */}
        <section id="about" className="lp-about">
          <div className="lp-container">
            <div className="lp-about-grid">
              <div className="lp-about-left">
                <Reveal>
                  <div className="lp-label">
                    <span className="lp-dot" />
                    <span>ABOUT</span>
                  </div>
                </Reveal>
                <Reveal delay={0.1}>
                  <h2 className="lp-about-headline">
                    BUILT FOR PEOPLE<br />WHO ACTUALLY<br />WATCH THINGS.
                  </h2>
                </Reveal>
                <Reveal delay={0.2}>
                  <p className="lp-about-text">
                    WatchVault is a personal media tracker designed for movie
                    buffs, binge-watchers, and anime enthusiasts. No social
                    clutter, no algorithmic noise — just your library, your way.
                  </p>
                </Reveal>
              </div>
              <div className="lp-about-right">
                <Reveal delay={0.15}>
                  <div className="lp-stats">
                    <Reveal delay={0.2}>
                      <div className="lp-stat">
                        <div className="lp-stat-val">3</div>
                        <div className="lp-stat-label">MEDIA TYPES</div>
                      </div>
                    </Reveal>
                    <Reveal delay={0.3}>
                      <div className="lp-stat">
                        <div className="lp-stat-val">4</div>
                        <div className="lp-stat-label">LIST TYPES</div>
                      </div>
                    </Reveal>
                    <Reveal delay={0.4}>
                      <div className="lp-stat">
                        <div className="lp-stat-val">∞</div>
                        <div className="lp-stat-label">TITLES</div>
                      </div>
                    </Reveal>
                    <Reveal delay={0.5}>
                      <div className="lp-stat">
                        <div className="lp-stat-val">0</div>
                        <div className="lp-stat-label">COST</div>
                      </div>
                    </Reveal>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ BOTTOM CTA ━━━ */}
        <section className="lp-bottom-cta">
          <div className="lp-container">
            <Reveal>
              <div className="lp-bottom-cta-content">
                <h2 className="lp-bottom-headline">READY TO START?</h2>
                <p className="lp-bottom-text">
                  Your personal watchlist awaits. Create an account and begin
                  tracking your media journey today.
                </p>
                <Link
                  href={session ? "/dashboard" : "/register"}
                  className="lp-cta lp-cta--lg"
                >
                  <span>{session ? "OPEN DASHBOARD" : "CREATE FREE ACCOUNT"}</span>
                  <ArrowUpRight className="h-5 w-5" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ━━━ FOOTER ━━━ */}
        <footer className="lp-footer">
          <div className="lp-container lp-footer-inner">
            <span className="lp-footer-copy">© 2026 WATCHVAULT</span>
            <div className="lp-footer-links">
              {session ? (
                <>
                  <Link href="/dashboard" className="lp-footer-link">DASHBOARD</Link>
                  <Link href="/library/movies" className="lp-footer-link">LIBRARY</Link>
                  <Link href="/profile" className="lp-footer-link">PROFILE</Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="lp-footer-link">SIGN IN</Link>
                  <Link href="/register" className="lp-footer-link">REGISTER</Link>
                </>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
