import "./globals.css";
import type { Metadata, Viewport } from "next";
import SessionProvider from "@/components/SessionProvider";
import { GeistSans } from "geist/font/sans";
import { Anton, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { RetroThemeProvider } from "@/components/layout/RetroThemeContext";
import MotionProvider from "@/components/MotionProvider";
import { THEME_SCRIPT } from "@/lib/themeScript";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-display",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Lumière",
  description: "Movies • TV • Anime tracker",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        className={`${GeistSans.className} ${anton.variable} ${plexMono.variable} min-h-screen antialiased`}
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
              <main id="main-content">{children}</main>
            </SessionProvider>
          </RetroThemeProvider>
        </MotionProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
