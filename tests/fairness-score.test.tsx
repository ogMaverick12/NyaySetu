import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  computeFairnessScore,
  getFairnessBand,
} from "@/features/fairness-score/services/fairness-calculator";
import { fairnessStore } from "@/features/fairness-score/store/fairness-store";
import { FairnessScoreCard } from "@/features/fairness-score/components/fairness-score-card";
import { FairnessMeter } from "@/features/fairness-score/components/fairness-meter";
import { type Clause } from "@/features/extraction/types";
import { type ComparisonResult } from "@/features/compare/types";
import { getContrastRatio, meetsWcagAA } from "@/tokens";

// Mock speech synthesis hook
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
let mockIsSpeaking = false;

vi.mock("@/features/accessibility", () => ({
  useSpeechSynthesis: () => ({
    speak: mockSpeak,
    cancel: mockCancel,
    isSpeaking: mockIsSpeaking,
    isSupported: true,
  }),
}));

describe("Fairness Score Feature Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSpeaking = false;
    fairnessStore.clear();
  });

  describe("1. Pure Scoring Function (Deterministic & Zero LLM)", () => {
    it("Case 1: All standard clauses result in a perfect score of 100 with 'strong' band", () => {
      const clauses: Clause[] = [
        {
          id: "c1",
          page: 1,
          type: "RENT_AND_DEPOSIT",
          sourceText: "Rent is payable monthly.",
          plainSummary: "Rent payment schedule",
          riskLevel: "info",
          rationale: "Standard rental clause",
        },
        {
          id: "c2",
          page: 2,
          type: "MAINTENANCE",
          sourceText: "Minor repairs by tenant.",
          plainSummary: "Maintenance obligation",
          riskLevel: "info",
          rationale: "Standard tenancy term",
        },
      ];

      const result = computeFairnessScore(clauses);

      expect(result.score).toBe(100);
      expect(result.band).toBe("strong");
      expect(result.isPartial).toBe(true);
      expect(result.topDrivers).toHaveLength(0);
    });

    it("Case 2: Mix of clauses with high-risk and caution applies exact penalties", () => {
      // 100 - (2 * 15) - (1 * 5) = 65 -> 'fair' band
      const clauses: Clause[] = [
        {
          id: "c1",
          page: 1,
          type: "TERMINATION",
          sourceText: "Landlord may terminate immediately without cause.",
          plainSummary: "Immediate termination without cause",
          riskLevel: "high-risk",
          rationale: "Unilateral termination",
        },
        {
          id: "c2",
          page: 3,
          type: "INDEMNITY",
          sourceText: "Partner indemnifies platform for all liabilities.",
          plainSummary: "Uncapped one-sided partner indemnity",
          riskLevel: "high-risk",
          rationale: "Severe asymmetry",
        },
        {
          id: "c3",
          page: 4,
          type: "LOCK_IN",
          sourceText: "3-year lock-in period.",
          plainSummary: "Lengthy lock-in period with forfeiture",
          riskLevel: "caution",
          rationale: "Lock-in restrictions",
        },
      ];

      const result = computeFairnessScore(clauses);

      expect(result.score).toBe(65);
      expect(result.band).toBe("fair");
      expect(result.isPartial).toBe(true);
      expect(result.topDrivers).toHaveLength(3);
      // Sorted by absolute impact: -15 first, then -5
      expect(Math.abs(result.topDrivers[0].weightApplied)).toBe(15);
      expect(Math.abs(result.topDrivers[1].weightApplied)).toBe(15);
      expect(Math.abs(result.topDrivers[2].weightApplied)).toBe(5);
    });

    it("Case 3: Zero clauses returns 100 without throwing errors", () => {
      const result = computeFairnessScore([]);

      expect(result.score).toBe(100);
      expect(result.band).toBe("strong");
      expect(result.topDrivers).toEqual([]);
    });

    it("Case 4: Compare not yet run returns isPartial: true", () => {
      const clauses: Clause[] = [
        {
          id: "c1",
          page: 1,
          type: "NOTICE",
          sourceText: "15 days notice.",
          plainSummary: "Asymmetric notice",
          riskLevel: "caution",
          rationale: "Notice disparity",
        },
      ];

      const result = computeFairnessScore(clauses, null);

      expect(result.isPartial).toBe(true);
      expect(result.score).toBe(95);
      expect(result.band).toBe("strong");
    });

    it("Case 5: More favors than disadvantages adds points and clamps at 100", () => {
      // 1 caution clause (-5) + 3 favorable differences (+15) -> 100 - 5 + 15 = 110 clamped to 100
      const clauses: Clause[] = [
        {
          id: "c1",
          page: 1,
          type: "NOTICE",
          sourceText: "Short notice.",
          plainSummary: "Short notice",
          riskLevel: "caution",
          rationale: "Notice clause",
        },
      ];

      const compareResult: ComparisonResult = {
        id: "cmp-1",
        mode: "doc_vs_baseline",
        baseName: "Model Tenancy Act (2021)",
        targetName: "Rental Deed",
        favorableCount: 3,
        disadvantageousCount: 0,
        neutralCount: 0,
        comparedAt: new Date().toISOString(),
        differences: [
          {
            id: "d1",
            clauseType: "DEPOSIT_LIMIT",
            title: "Deposit Capped Below Statutory Maximum",
            baseText: "2 months deposit",
            targetText: "1 month deposit",
            impactOnUser: "favorable",
            explanation: "Tenant pays lower deposit than statutory ceiling.",
            severity: "low",
          },
          {
            id: "d2",
            clauseType: "REPAIRS",
            title: "Landlord Structural Liability Guaranteed",
            baseText: "Shared maintenance",
            targetText: "Landlord covers structural maintenance",
            impactOnUser: "favorable",
            explanation: "Landlord assumes full structural repair costs.",
            severity: "low",
          },
          {
            id: "d3",
            clauseType: "NOTICE",
            title: "Extended 90-day Notice",
            baseText: "60-day notice",
            targetText: "90-day notice for tenant",
            impactOnUser: "favorable",
            explanation: "Tenant gets 90 days notice.",
            severity: "low",
          },
        ],
        summary: "Highly favorable contract",
      };

      const result = computeFairnessScore(clauses, compareResult);

      expect(result.score).toBe(100); // Clamped at 100
      expect(result.isPartial).toBe(false);
      expect(result.band).toBe("strong");
    });

    it("Case 6: Extreme penalties floor the score at 0 rather than negative values", () => {
      // 100 - (7 * 15) = 100 - 105 = -5 -> floored at 0
      const clauses: Clause[] = Array.from({ length: 7 }, (_, i) => ({
        id: `c${i}`,
        page: i + 1,
        type: "LIABILITY",
        sourceText: "Severe liability clause",
        plainSummary: `Severe liability ${i}`,
        riskLevel: "high-risk" as const,
        rationale: "High risk test",
      }));

      const result = computeFairnessScore(clauses);

      expect(result.score).toBe(0);
      expect(result.band).toBe("needs-negotiation");
    });

    it("Case 7: Verifies exact band threshold mappings", () => {
      expect(getFairnessBand(100)).toBe("strong");
      expect(getFairnessBand(80)).toBe("strong");
      expect(getFairnessBand(79)).toBe("fair");
      expect(getFairnessBand(60)).toBe("fair");
      expect(getFairnessBand(59)).toBe("caution");
      expect(getFairnessBand(40)).toBe("caution");
      expect(getFairnessBand(39)).toBe("needs-negotiation");
      expect(getFairnessBand(0)).toBe("needs-negotiation");
    });

    it("Case 8: Top drivers are strictly limited to top 3 and sorted descending by absolute magnitude", () => {
      const clauses: Clause[] = [
        {
          id: "c1",
          page: 1,
          type: "MINOR",
          sourceText: "Caution item 1",
          plainSummary: "Caution 1",
          riskLevel: "caution",
          rationale: "Minor",
        },
        {
          id: "c2",
          page: 2,
          type: "MAJOR",
          sourceText: "High risk item",
          plainSummary: "Major penalty",
          riskLevel: "high-risk",
          rationale: "Major",
        },
        {
          id: "c3",
          page: 3,
          type: "MINOR2",
          sourceText: "Caution item 2",
          plainSummary: "Caution 2",
          riskLevel: "caution",
          rationale: "Minor",
        },
        {
          id: "c4",
          page: 4,
          type: "MINOR3",
          sourceText: "Caution item 3",
          plainSummary: "Caution 3",
          riskLevel: "caution",
          rationale: "Minor",
        },
      ];

      const result = computeFairnessScore(clauses);

      expect(result.topDrivers).toHaveLength(3);
      expect(result.topDrivers[0].clauseId).toBe("c2"); // -15 pts
      expect(result.topDrivers[0].weightApplied).toBe(-15);
      expect(result.topDrivers[1].weightApplied).toBe(-5);
      expect(result.topDrivers[2].weightApplied).toBe(-5);
    });
  });

  describe("2. FairnessStore & Silent Compare Interceptor", () => {
    it("subscribes and notifies listeners when compareResult is updated or cleared", () => {
      const listener = vi.fn();
      const unsubscribe = fairnessStore.subscribe(listener);

      const sampleCompare: ComparisonResult = {
        id: "cmp-gig",
        mode: "doc_vs_baseline",
        baseName: "Fairwork Principles (2024)",
        targetName: "Platform Agreement",
        favorableCount: 0,
        disadvantageousCount: 1,
        neutralCount: 0,
        comparedAt: new Date().toISOString(),
        differences: [
          {
            id: "d1",
            clauseType: "DEACTIVATION",
            title: "Immediate Deactivation Clause",
            baseText: "14 days notice with human appeal",
            targetText: "Instant app deactivation without right of reply",
            impactOnUser: "disadvantageous",
            explanation: "Deprives worker of livelihood without process.",
            severity: "high",
          },
        ],
        summary: "Gig baseline disparity",
      };

      fairnessStore.setCompareResult(sampleCompare);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(fairnessStore.getSnapshot()).toBe(sampleCompare);

      fairnessStore.clear();
      expect(listener).toHaveBeenCalledTimes(2);
      expect(fairnessStore.getSnapshot()).toBeNull();

      unsubscribe();
      fairnessStore.setCompareResult(sampleCompare);
      expect(listener).toHaveBeenCalledTimes(2); // No new invocation after unsubscribing
    });
  });

  describe("3. WCAG AA Contrast Compliance Across Full Range", () => {
    it("validates that all band badge texts on their backgrounds meet WCAG AA (>= 4.5:1)", () => {
      // Strong: text #245437 on bg #EAF2EC
      const strongFg = "#245437";
      const strongBg = "#EAF2EC";
      const strongRatio = getContrastRatio(strongFg, strongBg);
      expect(strongRatio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(strongFg, strongBg)).toBe(true);

      // Fair: text #684B1E on bg #FAF3E8
      const fairFg = "#684B1E";
      const fairBg = "#FAF3E8";
      const fairRatio = getContrastRatio(fairFg, fairBg);
      expect(fairRatio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(fairFg, fairBg)).toBe(true);

      // Caution: text #6B450B on bg #FBF4E7
      const cautionFg = "#6B450B";
      const cautionBg = "#FBF4E7";
      const cautionRatio = getContrastRatio(cautionFg, cautionBg);
      expect(cautionRatio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(cautionFg, cautionBg)).toBe(true);

      // Needs Negotiation: text #8C2F39 on bg #F7ECEE
      const highFg = "#8C2F39";
      const highBg = "#F7ECEE";
      const highRatio = getContrastRatio(highFg, highBg);
      expect(highRatio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(highFg, highBg)).toBe(true);
    });

    it("validates dark ink on parchment card background exceeds 11:1", () => {
      const ink = "#1B2430";
      const parchmentCard = "#FBF9F4";
      const ratio = getContrastRatio(ink, parchmentCard);
      expect(ratio).toBeGreaterThan(11.0);
      expect(meetsWcagAA(ink, parchmentCard)).toBe(true);
    });
  });

  describe("4. React UI & Strict Gating Component Tests", () => {
    const sampleClauses: Clause[] = [
      {
        id: "c1",
        page: 1,
        type: "TERMINATION",
        sourceText: "Landlord can terminate anytime.",
        plainSummary: "Immediate termination",
        riskLevel: "high-risk",
        rationale: "Arbitrary cancellation",
      },
    ];

    it("strict gating: renders NOTHING (null) if extractionStatus is not 'success'", () => {
      const { container: c1 } = render(
        <FairnessScoreCard clauses={sampleClauses} extractionStatus="extracting" />
      );
      expect(c1.firstChild).toBeNull();

      const { container: c2 } = render(
        <FairnessScoreCard clauses={sampleClauses} extractionStatus="idle" />
      );
      expect(c2.firstChild).toBeNull();

      const { container: c3 } = render(
        <FairnessScoreCard clauses={sampleClauses} extractionStatus="error" />
      );
      expect(c3.firstChild).toBeNull();
    });

    it("strict gating: renders NOTHING (null) if clauses array is empty", () => {
      const { container } = render(<FairnessScoreCard clauses={[]} extractionStatus="success" />);
      expect(container.firstChild).toBeNull();
    });

    it("renders partial advisory banner and button when Compare has not run", () => {
      const onProceed = vi.fn();
      render(
        <FairnessScoreCard
          clauses={sampleClauses}
          extractionStatus="success"
          onProceedToCompare={onProceed}
        />
      );

      // Score is 100 - 15 = 85 -> 'strong' band
      expect(screen.getByText("Contract Fairness Score")).toBeDefined();
      expect(screen.getByText("85")).toBeDefined();

      // Check partial score label
      const partialLabel = screen.getByText("Partial score");
      expect(partialLabel).toBeDefined();
      expect(
        screen.getByText(/clause-based only\. Run Compare for the full picture/i)
      ).toBeDefined();

      // Check proceed button
      const compareBtn = screen.getByRole("button", { name: /Run Compare Mode/i });
      fireEvent.click(compareBtn);
      expect(onProceed).toHaveBeenCalledTimes(1);
    });

    it("silently recomputes to full score when compareResult is provided", () => {
      const compareResult: ComparisonResult = {
        id: "cmp-2",
        mode: "doc_vs_baseline",
        baseName: "Model Tenancy Act",
        targetName: "Rental Deed",
        favorableCount: 0,
        disadvantageousCount: 1,
        neutralCount: 0,
        comparedAt: new Date().toISOString(),
        differences: [
          {
            id: "diff-1",
            clauseType: "TERMINATION",
            title: "Notice Disparity",
            baseText: "60 days",
            targetText: "Immediate",
            impactOnUser: "disadvantageous",
            explanation: "Deprives tenant of notice.",
            severity: "high",
          },
        ],
        summary: "Comparison done",
      };

      // 100 - 15 (high risk) - 10 (disadvantage) = 75 -> 'fair' band
      render(
        <FairnessScoreCard
          clauses={sampleClauses}
          compareResult={compareResult}
          extractionStatus="success"
        />
      );

      expect(screen.getByText("75")).toBeDefined();
      expect(screen.getByText("Fair / Balanced")).toBeDefined();
      expect(screen.getByText(/Comprehensive score/i)).toBeDefined();
    });

    it("triggers speech synthesis when clicking Read Score", () => {
      render(<FairnessScoreCard clauses={sampleClauses} extractionStatus="success" />);

      const readBtn = screen.getByRole("button", { name: /Read fairness score summary aloud/i });
      fireEvent.click(readBtn);

      expect(mockSpeak).toHaveBeenCalledTimes(1);
      expect(mockSpeak.mock.calls[0][0]).toContain("Contract Fairness Score: 85 out of 100");
      expect(mockSpeak.mock.calls[0][0]).toContain("Partial score — clause-based only");
    });

    it("verifies meter component has accessible ARIA attributes", () => {
      render(<FairnessMeter score={72} band="fair" isPartial={false} />);

      const meter = screen.getByRole("meter");
      expect(meter.getAttribute("aria-valuenow")).toBe("72");
      expect(meter.getAttribute("aria-valuemin")).toBe("0");
      expect(meter.getAttribute("aria-valuemax")).toBe("100");
      expect(meter.getAttribute("aria-valuetext")).toContain("72 out of 100");
    });
  });
});
