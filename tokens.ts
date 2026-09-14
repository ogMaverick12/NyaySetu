/**
 * NyaySetu Design Tokens
 * Source of truth for palette, typography, risk hierarchy, and visual constants
 * Reference: 03-UIUX-BRIEF.md
 */

export const tokens = {
  colors: {
    ink: {
      DEFAULT: "#1B2430",
      deep: "#111822",
      muted: "#525D6B",
      subtle: "#8A94A1",
    },
    parchment: {
      DEFAULT: "#F7F3EA",
      card: "#FBF9F4",
      muted: "#EFE8DC",
      border: "#E0D7C6",
    },
    brass: {
      DEFAULT: "#B08D57",
      hover: "#9C7945",
      light: "#E8DFD0",
      text: "#684B1E", // High-contrast brass on parchment (WCAG AAA >= 7:1)
      dark: "#684B1E",
    },
    risk: {
      low: {
        DEFAULT: "#3F6C51",
        light: "#EAF2EC",
        border: "#A5CBB3",
        label: "Low Risk",
      },
      caution: {
        DEFAULT: "#C08A2E",
        light: "#FBF4E7",
        border: "#E5C88D",
        label: "Caution",
      },
      high: {
        DEFAULT: "#8C2F39",
        light: "#F7ECEE",
        border: "#D699A0",
        label: "High Risk",
      },
    },
  },
  typography: {
    fonts: {
      serif: "var(--font-fraunces), serif",
      sans: "var(--font-ibm-plex-sans), sans-serif",
      mono: "var(--font-ibm-plex-mono), monospace",
    },
  },
} as const;

export type RiskLevel = "info" | "caution" | "high-risk";

export interface RiskLevelConfig {
  readonly label: string;
  readonly color: string;
  readonly bgColor: string;
  readonly borderColor: string;
  readonly badgeVariant: "info" | "caution" | "high-risk";
}

export const RISK_LEVEL_CONFIG: Record<RiskLevel, RiskLevelConfig> = {
  info: {
    label: "Low Risk / Standard Clause",
    color: tokens.colors.risk.low.DEFAULT,
    bgColor: tokens.colors.risk.low.light,
    borderColor: tokens.colors.risk.low.border,
    badgeVariant: "info",
  },
  caution: {
    label: "Requires Attention",
    color: tokens.colors.risk.caution.DEFAULT,
    bgColor: tokens.colors.risk.caution.light,
    borderColor: tokens.colors.risk.caution.border,
    badgeVariant: "caution",
  },
  "high-risk": {
    label: "Significant Legal Risk",
    color: tokens.colors.risk.high.DEFAULT,
    bgColor: tokens.colors.risk.high.light,
    borderColor: tokens.colors.risk.high.border,
    badgeVariant: "high-risk",
  },
};

/**
 * Calculates relative luminance of an sRGB hex color per WCAG 2.1 specs.
 */
export function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculates WCAG contrast ratio between foreground and background hex colors.
 */
export function getContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = getRelativeLuminance(fgHex);
  const l2 = getRelativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Validates whether contrast meets WCAG 2.1 AA (>= 4.5 for normal text, >= 3.0 for large text).
 */
export function meetsWcagAA(fgHex: string, bgHex: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(fgHex, bgHex);
  return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
}

/**
 * Validates whether contrast meets WCAG 2.1 AAA (>= 7.0 for normal text, >= 4.5 for large text).
 */
export function meetsWcagAAA(fgHex: string, bgHex: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(fgHex, bgHex);
  return isLargeText ? ratio >= 4.5 : ratio >= 7.0;
}
