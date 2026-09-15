import { describe, it, expect } from "vitest";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { ChecklistItemSchema } from "@/features/checklist-export/types";
import { generateLegalMemo } from "@/features/checklist-export/services/checklist-generator";
import { buildLegalMemoPdf } from "@/features/checklist-export/services/pdf-exporter";

const sampleDoc: ParsedDocument = {
  id: "doc_lease_101",
  filename: "Bangalore_Residential_Lease_2024.pdf",
  mimeType: "application/pdf",
  fileSizeBytes: 24000,
  pageCount: 3,
  createdAt: "2026-09-14T10:00:00Z",
  fullText: `RESIDENTIAL TENANCY AGREEMENT
Clause 3. Security Deposit: Rs. 96,000 (3 months rent)
Clause 8. Termination: Landlord may terminate with 15 days notice. Tenant must provide 60 days notice.
Clause 14. Non-Compete & Restraint: Tenant shall not engage in commercial trade within 5km for 2 years.`,
  pages: [
    {
      pageNumber: 1,
      text: "Clause 3. Security Deposit: Rs. 96,000 (3 months rent)",
      charCount: 50,
      wordCount: 8,
    },
    {
      pageNumber: 2,
      text: "Clause 8. Termination: Landlord may terminate with 15 days notice. Tenant must provide 60 days notice.",
      charCount: 102,
      wordCount: 15,
    },
    {
      pageNumber: 3,
      text: "Clause 14. Non-Compete & Restraint: Tenant shall not engage in commercial trade within 5km for 2 years.",
      charCount: 104,
      wordCount: 16,
    },
  ],
  isOcr: false,
};

const sampleClauses: Clause[] = [
  {
    id: "cl_deposit",
    page: 1,
    sourceText: "Rs. 96,000 equivalent to 3 months rent as refundable deposit",
    type: "security_deposit",
    plainSummary: "Tenant pays 3 months deposit (Rs 96,000).",
    riskLevel: "caution",
    rationale: "Exceeds standard 2-month statutory cap.",
  },
  {
    id: "cl_notice",
    page: 2,
    sourceText: "Landlord may terminate with 15 days notice. Tenant must provide 60 days notice.",
    type: "termination_notice",
    plainSummary: "Asymmetric termination notice (15 days vs 60 days).",
    riskLevel: "high-risk",
    rationale: "Grossly asymmetric exit terms.",
  },
  {
    id: "cl_restraint",
    page: 3,
    sourceText: "Tenant shall not engage in commercial trade within 5km for 2 years post tenancy.",
    type: "non_compete",
    plainSummary: "Post-tenancy commercial non-compete for 2 years.",
    riskLevel: "high-risk",
    rationale: "Void restraint of trade under Indian law.",
  },
];

// ── Mock-lease-agreement clauses (the ones reported as broken) ─────────────
const mockLeaseClauses: Clause[] = [
  {
    id: "cl_lockin",
    page: 2,
    sourceText:
      "The tenancy shall have a lock-in period of 11 months. If the Tenant vacates before the expiry of the lock-in period, the Tenant shall forfeit the security deposit and pay two months' rent as early-exit penalty.",
    type: "lock_in",
    plainSummary:
      "You cannot leave for 11 months. If you leave early you lose your deposit and pay 2 months rent as penalty.",
    riskLevel: "high-risk",
    rationale: "Disproportionate forfeiture — both deposit and additional penalty.",
  },
  {
    id: "cl_escalation",
    page: 3,
    sourceText:
      "The monthly rent shall be increased by 10% at the end of every 12-month period without further notice.",
    type: "rent_escalation",
    plainSummary: "Rent goes up 10% every year automatically with no further notice.",
    riskLevel: "caution",
    rationale: "Automatic escalation without notice or negotiation opportunity.",
  },
];

const mockLeaseDoc: ParsedDocument = {
  ...sampleDoc,
  id: "doc_mock_lease",
  filename: "mock-lease-agreement.pdf",
  fullText: mockLeaseClauses.map((c) => c.sourceText).join("\n"),
};

describe("Action Checklist & Legal Memo Export (PRD F6)", () => {
  describe("ChecklistItemSchema Validation", () => {
    it("should validate a valid action item", () => {
      const validAction = {
        id: "act_1",
        text: "Obtain written receipt for deposit before transferring funds.",
        kind: "action" as const,
        sourceClauseId: "cl_deposit",
      };
      expect(ChecklistItemSchema.safeParse(validAction).success).toBe(true);
    });

    it("should validate a valid lawyer question", () => {
      const validQuestion = {
        id: "q_1",
        text: "Is the asymmetric notice clause enforceable under Section 106 of the Transfer of Property Act?",
        kind: "lawyer_question" as const,
        sourceClauseId: "cl_notice",
      };
      expect(ChecklistItemSchema.safeParse(validQuestion).success).toBe(true);
    });

    it("should reject an item with invalid kind", () => {
      expect(
        ChecklistItemSchema.safeParse({
          id: "item_x",
          text: "Some task",
          kind: "todo",
          sourceClauseId: null,
        }).success
      ).toBe(false);
    });

    it("should reject an item with empty text", () => {
      expect(
        ChecklistItemSchema.safeParse({
          id: "act_2",
          text: "",
          kind: "action",
          sourceClauseId: null,
        }).success
      ).toBe(false);
    });
  });

  describe("Automatic High-Risk Seeding (Zero User Input Invariant)", () => {
    it("should automatically derive action items and lawyer questions from high-risk clauses", () => {
      const memo = generateLegalMemo(sampleDoc, sampleClauses);

      expect(memo.highRiskCount).toBe(2);
      expect(memo.cautionCount).toBe(1);
      expect(memo.totalClauses).toBe(3);
      expect(memo.actionItems.length).toBeGreaterThanOrEqual(3);

      const noticeAction = memo.actionItems.find((a) => a.sourceClauseId === "cl_notice");
      expect(noticeAction).toBeDefined();
      expect(noticeAction?.text).toContain("reciprocal notice");

      const noticeQuestion = memo.lawyerQuestions.find((q) => q.sourceClauseId === "cl_notice");
      expect(noticeQuestion).toBeDefined();
      expect(noticeQuestion?.text).toContain("Section 106");

      const nonCompeteQuestion = memo.lawyerQuestions.find(
        (q) => q.sourceClauseId === "cl_restraint"
      );
      expect(nonCompeteQuestion).toBeDefined();
      expect(nonCompeteQuestion?.text).toContain("Section 27");

      expect(memo.statutoryCitations).toContain(
        "Transfer of Property Act, 1882 (Sec 106 — Notice to Quit)"
      );
      expect(memo.statutoryCitations).toContain(
        "Indian Contract Act, 1872 (Sec 27 — Agreement in Restraint of Trade Void)"
      );
    });

    it("should incorporate citizen-bookmarked questions from Q&A consultation", () => {
      const memo = generateLegalMemo(sampleDoc, sampleClauses, [
        "Can the landlord deduct painting costs without producing invoices?",
      ]);
      const found = memo.lawyerQuestions.find((q) => q.text.includes("deduct painting costs"));
      expect(found).toBeDefined();
      expect(found?.kind).toBe("lawyer_question");
      expect(found?.sourceClauseId).toBeNull();
    });
  });

  // ── Statutory citation correctness (the reported bug) ────────────────────
  describe("Statutory Citation Correctness — mock-lease-agreement.pdf", () => {
    it("lock-in clause: cites ICA Sec 74, NOT TPA Sec 106", () => {
      const memo = generateLegalMemo(mockLeaseDoc, mockLeaseClauses);

      const lockInQuestion = memo.lawyerQuestions.find((q) => q.sourceClauseId === "cl_lockin");
      expect(lockInQuestion).toBeDefined();

      // Must mention ICA Sec 74 (penalty / liquidated damages)
      expect(lockInQuestion?.text).toContain("Section 74");

      // Must NOT cite TPA Sec 106 (termination notice) — wrong subject matter
      expect(lockInQuestion?.text).not.toContain("Section 106");
      expect(lockInQuestion?.text).not.toContain("Transfer of Property Act");

      // Citation list must include ICA Sec 74
      expect(memo.statutoryCitations.join(" ")).toContain("Sec 74");
      // Citation list must NOT include TPA Sec 106
      expect(memo.statutoryCitations.join(" ")).not.toContain("Sec 106");
    });

    it("rent-escalation clause: does NOT cite TPA Sec 106", () => {
      const memo = generateLegalMemo(mockLeaseDoc, mockLeaseClauses);

      // Escalation is caution-level — may not generate a question, but if it does, must not cite Sec 106
      const escalationQuestion = memo.lawyerQuestions.find(
        (q) => q.sourceClauseId === "cl_escalation"
      );
      if (escalationQuestion) {
        expect(escalationQuestion.text).not.toContain("Section 106");
        expect(escalationQuestion.text).not.toContain("Transfer of Property Act");
      }

      // No TPA Sec 106 anywhere in citation list
      expect(memo.statutoryCitations.join(" ")).not.toContain("Sec 106");
    });

    it("lock-in action item concerns forfeiture/penalty, not notice negotiation", () => {
      const memo = generateLegalMemo(mockLeaseDoc, mockLeaseClauses);
      const lockInAction = memo.actionItems.find((a) => a.sourceClauseId === "cl_lockin");

      expect(lockInAction).toBeDefined();
      expect(lockInAction?.text.toLowerCase()).toMatch(/forfeit|penalt|lock.?in|early.?exit/);
      expect(lockInAction?.text.toLowerCase()).not.toContain("reciprocal notice");
    });
  });

  describe("PDF Memorandum Generation", () => {
    it("should build a valid jsPDF instance from legal memo data", () => {
      const memo = generateLegalMemo(sampleDoc, sampleClauses);
      const doc = buildLegalMemoPdf(memo);
      expect(doc).toBeDefined();
      expect(doc.internal.pages.length).toBeGreaterThanOrEqual(1);
    });
  });
});
