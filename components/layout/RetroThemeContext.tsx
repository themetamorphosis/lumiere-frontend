"use client";

import React, { createContext, useContext, useState } from "react";

export type ThemeType =
  | "retro-dark"
  | "retro-light";

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
  const [scanlines, setScanlines] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("wv-global-scanlines");
    return saved !== null ? saved === "true" : true;
  });
  const [theme, setTheme] = useState<ThemeType>(() => {
    if (typeof window === "undefined") return "retro-dark";
    const savedTheme = localStorage.getItem("wv-global-theme");
    if (
      savedTheme === "retro-dark" ||
      savedTheme === "retro-light"
    ) {
      return savedTheme as ThemeType;
    }
    if (savedTheme === "dark") return "retro-dark";
    if (savedTheme === "light") return "retro-light";
    return "retro-dark";
  });

  const handleSetScanlines = (val: boolean) => {
    setScanlines(val);
    try {
      localStorage.setItem("wv-global-scanlines", String(val));
    } catch {}
  };

  const handleSetTheme = (newTheme: ThemeType) => {
    setTheme(newTheme);
    try {
      localStorage.setItem("wv-global-theme", newTheme);
    } catch {}
  };

  const toggleTheme = () => {
    let nextTheme: ThemeType = "retro-dark";
    if (theme === "retro-dark") nextTheme = "retro-light";
    else if (theme === "retro-light") nextTheme = "retro-dark";

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
