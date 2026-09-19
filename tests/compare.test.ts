import { describe, it, expect } from "vitest";
import {
  BASELINE_TEMPLATES,
  buildDeterministicBaselineComparison,
  ComparisonDifferenceSchema,
  ComparisonResultSchema,
  type ComparisonDifference,
} from "@/features/compare";
import { type ParsedDocument } from "@/features/ingestion/types";

describe("Contract Compare Mode & Sourced Baseline Templates (F4)", () => {
  const sampleTenantDoc: ParsedDocument = {
    id: "doc_sample_lease",
    filename: "rental-agreement-2026.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 32000,
    pageCount: 2,
    pages: [
      {
        pageNumber: 1,
        text: "Tenant shall deposit with the Landlord a refundable security deposit of INR 96,000 (three months rent).",
        charCount: 104,
        wordCount: 16,
      },
      {
        pageNumber: 2,
        text: "Lessor may terminate this tenancy with 15 days notice; Lessee must provide 60 days notice.",
        charCount: 90,
        wordCount: 15,
      },
    ],
    fullText:
      "Tenant shall deposit with the Landlord a refundable security deposit of INR 96,000 (three months rent). Lessor may terminate this tenancy with 15 days notice; Lessee must provide 60 days notice.",
    isOcr: false,
    createdAt: new Date().toISOString(),
  };

  describe("Sourced Baseline Templates (Non-LLM Material)", () => {
    it("should provide pre-sourced baseline templates for all three starter domains", () => {
      expect(BASELINE_TEMPLATES.residential_tenancy).toBeDefined();
      expect(BASELINE_TEMPLATES.gig_worker_agreement).toBeDefined();
      expect(BASELINE_TEMPLATES.employment_offer).toBeDefined();
    });

    it("should have verifiable statutory sources cited on each baseline template", () => {
      expect(BASELINE_TEMPLATES.residential_tenancy.sourcedReference).toContain(
        "Model Tenancy Act"
      );
      expect(BASELINE_TEMPLATES.gig_worker_agreement.sourcedReference).toContain("Fairwork");
      expect(BASELINE_TEMPLATES.employment_offer.sourcedReference).toContain("Section 27");
    });

    it("should include substantive clauses for each baseline template", () => {
      Object.values(BASELINE_TEMPLATES).forEach((template) => {
        expect(template.clauses.length).toBeGreaterThanOrEqual(3);
        template.clauses.forEach((clause) => {
          expect(clause.id).toBeTruthy();
          expect(clause.standardText.length).toBeGreaterThan(20);
          expect(clause.legalNormRationale.length).toBeGreaterThan(10);
        });
      });
    });
  });

  describe("Comparison Difference Schema Validation", () => {
    it("should validate favorable, disadvantageous, and neutral impact types", () => {
      const validDiff: ComparisonDifference = {
        id: "diff_test_1",
        clauseType: "security_deposit",
        title: "Deposit Return Guarantee",
        baseText: "Deposit returned in 30 days",
        targetText: "Deposit returned in 15 days",
        impactOnUser: "favorable",
        explanation: "Shorter refund turnaround favors the tenant.",
        severity: "low",
      };

      expect(() => ComparisonDifferenceSchema.parse(validDiff)).not.toThrow();

      const disadvantageousDiff: ComparisonDifference = {
        ...validDiff,
        impactOnUser: "disadvantageous",
      };
      expect(() => ComparisonDifferenceSchema.parse(disadvantageousDiff)).not.toThrow();

      const neutralDiff: ComparisonDifference = {
        ...validDiff,
        impactOnUser: "neutral",
      };
      expect(() => ComparisonDifferenceSchema.parse(neutralDiff)).not.toThrow();
    });
  });

  describe("buildDeterministicBaselineComparison", () => {
    it("should flag 3-month deposit as disadvantageous against the 2-month Model Tenancy Act ceiling", () => {
      const result = buildDeterministicBaselineComparison(sampleTenantDoc, "residential_tenancy");

      expect(result.mode).toBe("doc_vs_baseline");
      expect(result.differences.length).toBeGreaterThan(0);

      const depositDiff = result.differences.find((d) => d.clauseType === "security_deposit");
      expect(depositDiff).toBeDefined();
      expect(depositDiff?.impactOnUser).toBe("disadvantageous");
      expect(depositDiff?.explanation).toContain("Model Tenancy");

      const noticeDiff = result.differences.find((d) => d.clauseType === "notice_period");
      expect(noticeDiff).toBeDefined();
      expect(noticeDiff?.impactOnUser).toBe("disadvantageous");
      expect(noticeDiff?.explanation).toContain("Asymmetric notice");

      expect(result.disadvantageousCount).toBeGreaterThanOrEqual(2);
      expect(() => ComparisonResultSchema.parse(result)).not.toThrow();
    });

    it("should match extracted clauses and NOT report 'not explicitly stated' when clauses are provided", () => {
      // Document with non-standard phrasing that would fail simple text regex
      const obscureDoc: ParsedDocument = {
        ...sampleTenantDoc,
        fullText: "The resident pays an initial guarantee sum of seventy thousand rupees.",
      };

      const extractedClauses = [
        {
          id: "cl_1",
          page: 1,
          sourceText: "The resident pays an initial guarantee sum of seventy thousand rupees.",
          type: "security_deposit",
          plainSummary: "Resident pays 70,000 INR deposit.",
          riskLevel: "caution" as const,
          rationale: "Deposit exceeds one month advance.",
        },
        {
          id: "cl_2",
          page: 1,
          sourceText: "Either party may conclude the agreement with thirty days writing.",
          type: "notice_period",
          plainSummary: "Reciprocal 30 days termination notice.",
          riskLevel: "info" as const,
          rationale: "Equal reciprocal notice.",
        },
      ];

      const result = buildDeterministicBaselineComparison(
        obscureDoc,
        "residential_tenancy",
        extractedClauses
      );

      const depositDiff = result.differences.find((d) => d.clauseType === "security_deposit");
      expect(depositDiff).toBeDefined();
      expect(depositDiff?.targetText).toBe(
        "The resident pays an initial guarantee sum of seventy thousand rupees."
      );
      expect(depositDiff?.targetText).not.toContain("Clause not explicitly stated");

      const noticeDiff = result.differences.find((d) => d.clauseType === "notice_period");
      expect(noticeDiff).toBeDefined();
      expect(noticeDiff?.targetText).toBe(
        "Either party may conclude the agreement with thirty days writing."
      );
      expect(noticeDiff?.targetText).not.toContain("Clause not explicitly stated");
    });
  });
});
