import "./globals.css";
import type { Metadata, Viewport } from "next";
import SessionProvider from "@/components/SessionProvider";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { RetroThemeProvider } from "@/components/layout/RetroThemeContext";

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
// Reads localStorage and sets data-theme on <html> synchronously.
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('wv-global-theme');
    if (t === 'retro-light') {
      document.documentElement.setAttribute('data-theme', 'retro-light');
    } else {
      document.documentElement.setAttribute('data-theme', 'retro-dark');
    }
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'retro-dark');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script — runs before any CSS paint, prevents theme flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
        <RetroThemeProvider>
          <SessionProvider>
            <main id="main-content">{children}</main>
          </SessionProvider>
        </RetroThemeProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
