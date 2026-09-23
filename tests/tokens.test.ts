import { describe, it, expect } from "vitest";
import { tokens, RISK_LEVEL_CONFIG, type RiskLevel, getContrastRatio, meetsWcagAA } from "@/tokens";

describe("NyaySetu Tokens & Risk System", () => {
  it("should define authentic ink navy, parchment, and brass colors", () => {
    expect(tokens.colors.ink.DEFAULT).toBe("#1B2430");
    expect(tokens.colors.parchment.DEFAULT).toBe("#F7F3EA");
    expect(tokens.colors.brass.DEFAULT).toBe("#B08D57");
  });

  it("should define all three required risk levels", () => {
    const riskLevels: RiskLevel[] = ["info", "caution", "high-risk"];
    for (const level of riskLevels) {
      expect(RISK_LEVEL_CONFIG[level]).toBeDefined();
      expect(RISK_LEVEL_CONFIG[level].label).toBeTruthy();
      expect(RISK_LEVEL_CONFIG[level].color).toMatch(/^#/);
      expect(RISK_LEVEL_CONFIG[level].bgColor).toMatch(/^#/);
    }
  });

  it("should define Google Fonts variables for typography hierarchy", () => {
    expect(tokens.typography.fonts.serif).toContain("--font-fraunces");
    expect(tokens.typography.fonts.sans).toContain("--font-ibm-plex-sans");
    expect(tokens.typography.fonts.mono).toContain("--font-ibm-plex-mono");
  });

  it("should define WCAG AA-passing interactive brass variants for text/fills", () => {
    expect(tokens.colors.brass.interactive).toBe("#5F421A");
    expect(tokens.colors.brass.interactiveHover).toBe("#4E3515");
    const parchment = tokens.colors.parchment.DEFAULT;
    // Button fill itself passes 3:1 as non-text UI on parchment…
    expect(getContrastRatio(tokens.colors.brass.interactive, parchment)).toBeGreaterThanOrEqual(
      3.0
    );
    // …and cream label text on top passes AA normal text.
    expect(meetsWcagAA("#FAF8F3", tokens.colors.brass.interactive)).toBe(true);
    expect(meetsWcagAA("#FAF8F3", tokens.colors.brass.interactiveHover)).toBe(true);
  });

  it("should define a WCAG AA-passing caution text variant", () => {
    expect(tokens.colors.risk.caution.text).toBe("#6B450B");
    expect(meetsWcagAA(tokens.colors.risk.caution.text, tokens.colors.risk.caution.light)).toBe(
      true
    );
  });
});
