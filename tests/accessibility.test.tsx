import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { tokens, getContrastRatio, meetsWcagAA, meetsWcagAAA } from "@/tokens";
import {
  AccessibilityProvider,
  AccessibilityBar,
  TRANSLATIONS,
  type SupportedLanguage,
} from "@/features/accessibility";
import { RedlineCard } from "@/features/compare/components/redline-card";
import { type ComparisonDifference } from "@/features/compare/types";

describe("Accessibility & Trust Suite (WCAG 2.1 AA, Contrast, Screen Readers, i18n)", () => {
  describe("1. Mathematical Contrast Verification (WCAG AA & AAA)", () => {
    it("verifies dark brass text (#684B1E) on parchment (#F7F3EA) passes WCAG AA and AAA", () => {
      const darkBrass = tokens.colors.brass.text; // #684B1E
      const parchment = tokens.colors.parchment.DEFAULT; // #F7F3EA

      const ratio = getContrastRatio(darkBrass, parchment);
      expect(ratio).toBeGreaterThanOrEqual(7.0); // Exceeds AAA (7:1)
      expect(meetsWcagAA(darkBrass, parchment)).toBe(true);
      expect(meetsWcagAAA(darkBrass, parchment)).toBe(true);
    });

    it("verifies old brass accent (#B08D57) fails WCAG AA on parchment, confirming need for remediation", () => {
      const defaultBrass = tokens.colors.brass.DEFAULT; // #B08D57
      const parchment = tokens.colors.parchment.DEFAULT; // #F7F3EA

      const ratio = getContrastRatio(defaultBrass, parchment);
      // 2.76:1 fails WCAG AA minimum of 4.5:1
      expect(ratio).toBeLessThan(4.5);
      expect(meetsWcagAA(defaultBrass, parchment)).toBe(false);
    });

    it("verifies ink navy text (#1B2430) on parchment exceeds 11:1 contrast", () => {
      const inkNavy = tokens.colors.ink.DEFAULT; // #1B2430
      const parchment = tokens.colors.parchment.DEFAULT; // #F7F3EA

      const ratio = getContrastRatio(inkNavy, parchment);
      expect(ratio).toBeGreaterThan(11.0);
      expect(meetsWcagAA(inkNavy, parchment)).toBe(true);
    });
  });

  describe("2. Screen Reader Semantics for Redline UI (features/compare)", () => {
    const sampleDiff: ComparisonDifference = {
      id: "diff_term_1",
      clauseType: "TERMINATION_NOTICE",
      title: "Termination Notice Disparity",
      baseText: "Either party may terminate with 60 days written notice.",
      targetText: "Lessor may terminate this tenancy with 15 days notice.",
      impactOnUser: "disadvantageous",
      explanation: "Notice period is heavily asymmetric against the tenant.",
      severity: "high",
    };

    it("renders <del> with role='deletion' and screen-reader context", () => {
      const { container } = render(<RedlineCard difference={sampleDiff} />);

      const delEl = container.querySelector("del");
      expect(delEl).not.toBeNull();
      expect(delEl?.getAttribute("role")).toBe("deletion");

      const srOnlySpan = delEl?.querySelector(".sr-only");
      expect(srOnlySpan).not.toBeNull();
      expect(srOnlySpan?.textContent).toContain("Original text removed or replaced:");
    });

    it("renders <ins> with role='insertion' and screen-reader context", () => {
      const { container } = render(<RedlineCard difference={sampleDiff} />);

      const insEl = container.querySelector("ins");
      expect(insEl).not.toBeNull();
      expect(insEl?.getAttribute("role")).toBe("insertion");

      const srOnlySpan = insEl?.querySelector(".sr-only");
      expect(srOnlySpan).not.toBeNull();
      expect(srOnlySpan?.textContent).toContain("New revised text inserted:");
    });

    it("includes non-color signals and screen reader announcement for change impact", () => {
      const { container } = render(<RedlineCard difference={sampleDiff} />);

      expect(container.textContent).toContain("Disadvantages You");
      expect(container.textContent).toContain("This contract change disadvantages the citizen");
    });
  });

  describe("3. axe-core WCAG 2.1 AA Automated Audit", () => {
    it("runs axe-core on AccessibilityBar with no WCAG AA violations", async () => {
      const { container } = render(
        <AccessibilityProvider>
          <header>
            <AccessibilityBar />
          </header>
          <main id="main-content">
            <h1>Test Title</h1>
            <p>Test content for accessibility verification.</p>
          </main>
        </AccessibilityProvider>
      );

      const results = await axe.run(container, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa"],
        },
      });

      expect(results.violations).toEqual([]);
    });

    it("runs axe-core on RedlineCard with no WCAG AA violations", async () => {
      const sampleDiff: ComparisonDifference = {
        id: "diff_dep_1",
        clauseType: "SECURITY_DEPOSIT",
        title: "Deposit Refund Disparity",
        baseText: "Tenant shall deposit maximum 2 months rent.",
        targetText: "Tenant shall deposit INR 96,000.",
        impactOnUser: "disadvantageous",
        explanation: "Negotiate deposit down to statutory maximum.",
        severity: "medium",
      };

      const { container } = render(
        <main>
          <RedlineCard difference={sampleDiff} />
        </main>
      );

      const results = await axe.run(container, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa"],
        },
      });

      expect(results.violations).toEqual([]);
    });
  });

  describe("4. Multilingual Dictionary & Parity Audit (English, Hindi, Tamil)", () => {
    const languages: SupportedLanguage[] = ["en", "hi", "ta"];

    it("ensures all supported languages are registered", () => {
      for (const lang of languages) {
        expect(TRANSLATIONS[lang]).toBeDefined();
        expect(TRANSLATIONS[lang].appName).toBeTruthy();
        expect(TRANSLATIONS[lang].appSubtitle).toBeTruthy();
      }
    });

    it("verifies exact key parity between English, Hindi, and Tamil dictionaries", () => {
      const en = TRANSLATIONS.en;
      const hi = TRANSLATIONS.hi;
      const ta = TRANSLATIONS.ta;

      function assertKeysMatch(
        objA: Record<string, unknown>,
        objB: Record<string, unknown>,
        path = ""
      ) {
        const keysA = Object.keys(objA).sort();
        const keysB = Object.keys(objB).sort();

        expect(keysB, `Key mismatch at ${path}`).toEqual(keysA);

        for (const key of keysA) {
          const valA = objA[key];
          const valB = objB[key];
          const currentPath = path ? `${path}.${key}` : key;

          if (valA && typeof valA === "object" && !Array.isArray(valA)) {
            expect(typeof valB, `Type mismatch at ${currentPath}`).toBe("object");
            assertKeysMatch(
              valA as Record<string, unknown>,
              valB as Record<string, unknown>,
              currentPath
            );
          } else {
            expect(typeof valB, `Type mismatch at ${currentPath}`).toBe("string");
            expect(
              (valB as string).length,
              `Empty translation string at ${currentPath}`
            ).toBeGreaterThan(0);
          }
        }
      }

      // Check Hindi against English
      assertKeysMatch(
        en as unknown as Record<string, unknown>,
        hi as unknown as Record<string, unknown>,
        "hi"
      );
      // Check Tamil against English
      assertKeysMatch(
        en as unknown as Record<string, unknown>,
        ta as unknown as Record<string, unknown>,
        "ta"
      );
    });
  });

  describe("5. Skip-Link and Keyboard Accessibility", () => {
    it("renders a visible skip-to-content anchor targeted to #main-content", () => {
      const { getByText } = render(
        <AccessibilityProvider>
          <AccessibilityBar />
        </AccessibilityProvider>
      );

      const skipLink = getByText(TRANSLATIONS.en.accessibility.skipToContent);
      expect(skipLink).toBeInTheDocument();
      expect(skipLink.getAttribute("href")).toBe("#main-content");
    });
  });
});
