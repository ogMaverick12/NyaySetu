"use client";

import { useAccessibility } from "../context/accessibility-context";
import { type SupportedLanguage } from "../i18n/translations";
import { Globe, WifiOff, Wifi, Eye } from "lucide-react";
import { DeleteDataButton } from "@/features/security";

export interface AccessibilityBarProps {
  onDataDeleted?: () => void;
}

export function AccessibilityBar({ onDataDeleted }: AccessibilityBarProps = {}): JSX.Element {
  const { language, setLanguage, isLowBandwidth, toggleLowBandwidth, prefersReducedMotion, t } =
    useAccessibility();

  const languages: Array<{ code: SupportedLanguage; label: string }> = [
    { code: "en", label: "English" },
    { code: "hi", label: "हिन्दी" },
    { code: "ta", label: "தமிழ்" },
  ];

  return (
    <aside aria-label="Accessibility & Localization Bar" className="relative z-50">
      {/* Skip to Main Content Link (WCAG 2.4.1 Bypass Blocks) */}
      <a
        href="#main-content"
        className="sr-only font-mono text-xs font-semibold focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-[#1B2430] focus:px-4 focus:py-2 focus:text-[#F7F3EA] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#B08D57]"
      >
        {t.accessibility.skipToContent}
      </a>

      {/* Top Utility Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E0D7C6]/60 bg-[#F7F3EA] px-4 py-2 font-sans text-xs text-[#525D6B]">
        {/* Left: Language Selection */}
        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label={t.accessibility.language}
        >
          <Globe className="h-3.5 w-3.5 text-[#684B1E]" aria-hidden="true" />
          <span className="mr-1 font-mono text-[11px] font-semibold text-[#684B1E]">
            {t.accessibility.language}:
          </span>
          <div className="flex items-center gap-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                aria-pressed={language === lang.code}
                className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[#B08D57] ${
                  language === lang.code
                    ? "border-[#1B2430] bg-[#1B2430] text-[#F7F3EA]"
                    : "border-[#E0D7C6] bg-white text-[#1B2430] hover:bg-[#EFE8DC]"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Low-Bandwidth Mode, Motion Status & Privacy Data Purge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {prefersReducedMotion && (
            <span className="inline-flex items-center gap-1 rounded border border-[#B08D57]/30 bg-[#B08D57]/10 px-2 py-0.5 font-mono text-[11px] text-[#684B1E]">
              <Eye className="h-3 w-3" />
              Motion Reduced
            </span>
          )}

          <button
            type="button"
            onClick={toggleLowBandwidth}
            aria-pressed={isLowBandwidth}
            className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] transition-colors focus:outline-none focus:ring-1 focus:ring-[#B08D57] ${
              isLowBandwidth
                ? "border-[#3F6C51] bg-[#3F6C51] text-white"
                : "border-[#E0D7C6] bg-white text-[#1B2430] hover:bg-[#EFE8DC]"
            }`}
          >
            {isLowBandwidth ? (
              <>
                <WifiOff className="h-3 w-3 text-white" />
                <span>{t.accessibility.lowBandwidthActive}</span>
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3 text-[#525D6B]" />
                <span>{t.accessibility.lowBandwidth}</span>
              </>
            )}
          </button>

          <span className="text-[#E0D7C6]" aria-hidden="true">
            |
          </span>

          <DeleteDataButton onDataDeleted={onDataDeleted} />
        </div>
      </div>
    </aside>
  );
}
