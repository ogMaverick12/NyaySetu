"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  type SupportedLanguage,
  type TranslationDictionary,
  TRANSLATIONS,
} from "../i18n/translations";

interface AccessibilityContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  isLowBandwidth: boolean;
  toggleLowBandwidth: () => void;
  prefersReducedMotion: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  t: TranslationDictionary;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect system prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);

      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener?.("change", listener);
      return () => mediaQuery.removeEventListener?.("change", listener);
    }
  }, []);

  // Initialise dark mode from localStorage or system preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("nyaysetu_dark_mode");
    const prefersDark =
      stored !== null
        ? stored === "true"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDarkMode(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  // Synchronize low-bandwidth class to document body
  const toggleLowBandwidth = () => {
    setIsLowBandwidth((prev) => {
      const next = !prev;
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("low-bandwidth", next);
      }
      return next;
    });
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("nyaysetu_dark_mode", String(next));
      }
      return next;
    });
  };

  const t = TRANSLATIONS[language];

  return (
    <AccessibilityContext.Provider
      value={{
        language,
        setLanguage,
        isLowBandwidth,
        toggleLowBandwidth,
        prefersReducedMotion,
        isDarkMode,
        toggleDarkMode,
        t,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

const DEFAULT_VALUE: AccessibilityContextValue = {
  language: "en",
  setLanguage: () => {},
  isLowBandwidth: false,
  toggleLowBandwidth: () => {},
  prefersReducedMotion: false,
  isDarkMode: false,
  toggleDarkMode: () => {},
  t: TRANSLATIONS.en,
};

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext);
  return context || DEFAULT_VALUE;
}
