import "@fontsource-variable/inter";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/300.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import SessionProvider from "@/components/SessionProvider";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { RetroThemeProvider } from "@/components/layout/RetroThemeContext";
import MotionProvider from "@/components/MotionProvider";
import { THEME_SCRIPT } from "@/lib/themeScript";

export const metadata: Metadata = {
  title: "Lumière",
  description: "Movies • TV • Anime tracker",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Inline script injected before React hydration to prevent theme flash.
// Reads localStorage and sets data-theme on <html> synchronously. Defined in
// lib/themeScript so next.config.ts can hash the identical string for the CSP.

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script — runs before any CSS paint, prevents theme flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className={`${GeistSans.className} min-h-screen antialiased`}
        style={{ background: "var(--bg)", color: "var(--text-primary)" }}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black"
        >
          Skip to content
        </a>
        <MotionProvider>
          <RetroThemeProvider>
            <SessionProvider>
              {children}
            </SessionProvider>
          </RetroThemeProvider>
        </MotionProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
