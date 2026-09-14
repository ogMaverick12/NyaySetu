import { describe, it, expect } from "vitest";
import { tokens, RISK_LEVEL_CONFIG, type RiskLevel } from "@/tokens";

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
});
