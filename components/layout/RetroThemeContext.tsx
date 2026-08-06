"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeType = "retro-dark" | "retro-light";

interface RetroThemeContextType {
  scanlines: boolean;
  setScanlines: (val: boolean) => void;
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
}

const RetroThemeContext = createContext<RetroThemeContextType | undefined>(
  undefined,
);

export function RetroThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always start with the SSR-safe default — NO localStorage in initial state
  const [theme, setThemeState] = useState<ThemeType>("retro-dark");
  const [scanlines, setScanlinesState] = useState<boolean>(true);

  // After hydration, read the real saved values and apply them
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("wv-global-theme");
      let resolved: ThemeType = "retro-dark";
      if (savedTheme === "retro-dark" || savedTheme === "retro-light") {
        resolved = savedTheme as ThemeType;
      } else if (savedTheme === "light") {
        resolved = "retro-light";
      }
      setTimeout(() => {
        setThemeState(resolved);
        const savedScanlines = localStorage.getItem("wv-global-scanlines");
        setScanlinesState(savedScanlines !== null ? savedScanlines === "true" : true);
      }, 0);
    } catch {}
  }, []);

  // Keep document.documentElement[data-theme] in sync — this is what CSS selectors target
  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", theme);
    } catch {}
  }, [theme]);

  const handleSetScanlines = (val: boolean) => {
    setScanlinesState(val);
    try {
      localStorage.setItem("wv-global-scanlines", String(val));
    } catch {}
  };

  const handleSetTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("wv-global-theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    } catch {}
  };

  const toggleTheme = () => {
    const nextTheme: ThemeType =
      theme === "retro-dark" ? "retro-light" : "retro-dark";
    handleSetTheme(nextTheme);
  };

  return (
    <RetroThemeContext.Provider
      value={{
        scanlines,
        setScanlines: handleSetScanlines,
        theme,
        setTheme: handleSetTheme,
        toggleTheme,
      }}
    >
      {children}
    </RetroThemeContext.Provider>
  );
}

export function useRetroTheme() {
  const context = useContext(RetroThemeContext);
  if (!context) {
    throw new Error("useRetroTheme must be used within a RetroThemeProvider");
  }
  return context;
}
