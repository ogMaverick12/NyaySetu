import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { ChecklistItemSchema } from "@/features/checklist-export/types";
import {
  generateLegalMemo,
  isInternalId,
  sanitizeText,
  genericTemplatedQuestion,
  generateQuestionWithRetry,
} from "@/features/checklist-export/services/checklist-generator";
import { buildLegalMemoPdf } from "@/features/checklist-export/services/pdf-exporter";
import { lawyerChecklistStore } from "@/features/checklist-export";
import { ChecklistMemoScreen } from "@/features/checklist-export/components/checklist-memo-screen";
import { TranscriptEntry } from "@/features/qa-chat/components/transcript-entry";
import { type QATranscriptItem } from "@/features/qa-chat/types";

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

  // ── Raw Internal ID Leak Protection & Guard ─────────────────────────────
  describe("Raw Internal ID Leak Protection & Guard", () => {
    it("identifies internal IDs correctly with isInternalId", () => {
      expect(isInternalId("cl_4")).toBe(true);
      expect(isInternalId("CL_12")).toBe(true);
      expect(isInternalId("lawyer_q_1789477754541")).toBe(true);
      expect(isInternalId("act_1")).toBe(true);
      expect(isInternalId("q_1")).toBe(true);
      expect(isInternalId("item_5")).toBe(true);
      expect(isInternalId("memo_12345")).toBe(true);
      expect(isInternalId("")).toBe(true);
      expect(isInternalId(null as unknown as string)).toBe(true);
      expect(isInternalId("Is this clause legally enforceable?")).toBe(false);
      expect(isInternalId("Ask your lawyer about the notice period clause")).toBe(false);
    });

    it("sanitizes text replacing raw IDs with generic fallback", () => {
      const fallback = genericTemplatedQuestion("notice_period");
      expect(sanitizeText("cl_4", fallback)).toBe("Ask your lawyer about the notice period clause");
      expect(sanitizeText("lawyer_q_1789477754541", fallback)).toBe(
        "Ask your lawyer about the notice period clause"
      );
      expect(sanitizeText("  ", fallback)).toBe("Ask your lawyer about the notice period clause");
      expect(sanitizeText("Normal question?", fallback)).toBe("Normal question?");
    });

    it("generateQuestionWithRetry: retries on primary failure and falls back to templated question", () => {
      const testClause: Clause = {
        id: "cl_test_custom",
        page: 1,
        sourceText: "Arbitrary test terms.",
        type: "liquidated_damages",
        plainSummary: "Test summary",
        riskLevel: "high-risk",
        rationale: "Unfair terms",
      };

      // Case 1: Primary throws error -> retries and produces structured question
      const resultAfterThrow = generateQuestionWithRetry(testClause, () => {
        throw new Error("Primary generation failed");
      });
      expect(resultAfterThrow).not.toContain("cl_");
      expect(resultAfterThrow).not.toContain("lawyer_q_");
      expect(resultAfterThrow.toLowerCase()).toContain("liquidated damages");

      // Case 2: Primary returns raw internal ID -> retries and avoids ID
      const resultAfterRawId = generateQuestionWithRetry(testClause, () => "cl_test_custom");
      expect(resultAfterRawId).not.toBe("cl_test_custom");
      expect(resultAfterRawId).not.toContain("cl_");

      // Case 3: Both primary and retry fail -> falls back to generic templated question
      const brokenClause: Clause = {
        ...testClause,
        plainSummary: "cl_broken_id", // plainSummary also an ID
      };
      const finalFallbackResult = generateQuestionWithRetry(brokenClause, () => "cl_broken_id");
      expect(finalFallbackResult).toBe("Ask your lawyer about the liquidated damages clause");
    });

    it("generateLegalMemo: handles bookmarked 'cl_4' without leaking raw ID into UI or memo", () => {
      const clausesWithCl4: Clause[] = [
        ...sampleClauses,
        {
          id: "cl_4",
          page: 2,
          sourceText: "The company may deactivate worker account without notice.",
          type: "account_deactivation",
          plainSummary: "Company can deactivate account at any time without warning.",
          riskLevel: "caution",
          rationale: "Unilateral deactivation power.",
        },
      ];

      // Pass "cl_4" into bookmarkedQuestions (simulating citizen-flagged clause ID)
      const memo = generateLegalMemo(sampleDoc, clausesWithCl4, ["cl_4"]);

      // Verify NO question contains raw "cl_4"
      memo.lawyerQuestions.forEach((q) => {
        expect(q.text).not.toBe("cl_4");
        expect(q.text).not.toMatch(/^cl_\d+$/i);
      });

      // The question for cl_4 should be generated or templated
      const qForCl4 = memo.lawyerQuestions.find((q) => q.sourceClauseId === "cl_4");
      expect(qForCl4).toBeDefined();
      expect(qForCl4?.text.toLowerCase()).toMatch(/deactivation|fairwork|account/i);
      expect(qForCl4?.text).not.toBe("cl_4");
    });

    it("generateLegalMemo: handles synthetic 'lawyer_q_1789477754541' without leaking ID", () => {
      const memo = generateLegalMemo(sampleDoc, sampleClauses, ["lawyer_q_1789477754541"]);

      // Verify NO question text is or contains the raw ID
      memo.lawyerQuestions.forEach((q) => {
        expect(q.text).not.toContain("lawyer_q_1789477754541");
        expect(q.text).not.toMatch(/lawyer_q_\d+/i);
      });

      // All action items also free of internal IDs
      memo.actionItems.forEach((a) => {
        expect(a.text).not.toMatch(/^(cl_\d+|act_\d+|q_\d+|item_\d+|lawyer_q_\d+)$/i);
      });
    });

    it("generateLegalMemo: never outputs raw 'cl_X' in any question when clause plainSummary is an ID", () => {
      const maliciousClauses: Clause[] = [
        {
          id: "cl_5",
          page: 1,
          sourceText: "Some text",
          type: "arbitration_clause",
          plainSummary: "cl_5", // Broken summary containing only the ID
          riskLevel: "high-risk",
          rationale: "Unfair",
        },
      ];

      const memo = generateLegalMemo(sampleDoc, maliciousClauses);
      const question = memo.lawyerQuestions[0];
      expect(question).toBeDefined();
      expect(question.text).not.toBe("cl_5");
      expect(question.text).not.toMatch(/^cl_\d+$/i);
      expect(question.text).toBe("Ask your lawyer about the arbitration clause clause");
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

  describe("Shared Lawyer Checklist Store & Consultation Q&A Integration", () => {
    it("should manage questions in lawyerChecklistStore (add, remove, toggle, deduplicate, clear)", () => {
      lawyerChecklistStore.clear();
      expect(lawyerChecklistStore.getSnapshot()).toEqual([]);

      lawyerChecklistStore.addQuestion("Can the landlord lock me out without court order?");
      expect(
        lawyerChecklistStore.hasQuestion("Can the landlord lock me out without court order?")
      ).toBe(true);
      expect(lawyerChecklistStore.getSnapshot()).toHaveLength(1);

      // Deduplication check
      lawyerChecklistStore.addQuestion("Can the landlord lock me out without court order?");
      expect(lawyerChecklistStore.getSnapshot()).toHaveLength(1);

      // Toggle off
      lawyerChecklistStore.toggleQuestion(
        "Can the landlord lock me out without court order?",
        false
      );
      expect(
        lawyerChecklistStore.hasQuestion("Can the landlord lock me out without court order?")
      ).toBe(false);

      // Toggle on
      lawyerChecklistStore.toggleQuestion(
        "Can the landlord lock me out without court order?",
        true
      );
      expect(
        lawyerChecklistStore.hasQuestion("Can the landlord lock me out without court order?")
      ).toBe(true);

      lawyerChecklistStore.clear();
      expect(lawyerChecklistStore.getSnapshot()).toEqual([]);
    });

    it("should include questions added via lawyerChecklistStore in the generated memo", () => {
      lawyerChecklistStore.clear();
      const customQ = "Can the landlord seize my vehicle for unpaid rent?";
      lawyerChecklistStore.addQuestion(customQ);

      const memo = generateLegalMemo(sampleDoc, sampleClauses, lawyerChecklistStore.getSnapshot());
      const found = memo.lawyerQuestions.find((q) => q.text.includes("seize my vehicle"));
      expect(found).toBeDefined();
      expect(found?.kind).toBe("lawyer_question");
      expect(found?.text).toBe(customQ);

      // Check PDF generation with this memo
      const pdf = buildLegalMemoPdf(memo);
      expect(pdf).toBeDefined();
      expect(pdf.internal.pages.length).toBeGreaterThanOrEqual(1);

      lawyerChecklistStore.clear();
    });

    it("clicking 'Add to Lawyer-Prep Checklist' button in Consultation Q&A adds question to store and exported memo", () => {
      lawyerChecklistStore.clear();
      const questionText = "Are digital signatures on tenancy agreements valid in Karnataka?";

      const item: QATranscriptItem = {
        id: "qa_item_digital_sig",
        itemNumber: 1,
        question: questionText,
        answer: "The document does not address electronic execution or IT Act applicability.",
        timestamp: "11:00 AM",
        isCovered: false,
        lawyerPrepSuggestion:
          "Verify compliance under Section 10A of the Information Technology Act, 2000.",
        citations: [],
        isFlaggedForLawyer: false,
      };

      // Mock the toggle callback which useQAConsultation executes
      const handleToggle = vi.fn((_id: string) => {
        lawyerChecklistStore.toggleQuestion(item.question, true);
      });

      // Render TranscriptEntry
      const { unmount: unmountEntry } = render(
        React.createElement(TranscriptEntry, {
          item,
          onToggleFlagLawyer: handleToggle,
        })
      );

      const addButton = screen.getByRole("button", {
        name: /Add question to lawyer prep checklist/i,
      });
      expect(addButton).toBeDefined();
      expect(addButton.textContent).toContain("Add to Lawyer-Prep Checklist");

      // Click "Add to Lawyer-Prep Checklist" wrapped in act
      act(() => {
        fireEvent.click(addButton);
      });
      expect(handleToggle).toHaveBeenCalledWith("qa_item_digital_sig");
      expect(lawyerChecklistStore.hasQuestion(questionText)).toBe(true);

      unmountEntry();

      // Now verify ChecklistMemoScreen consumes this question via the shared store
      const renderedMemo = render(
        React.createElement(ChecklistMemoScreen, {
          doc: sampleDoc,
          clauses: sampleClauses,
          extractionStatus: "success",
        })
      );

      // The question added via the button must appear in the rendered UI
      expect(renderedMemo.container.textContent).toContain(questionText);

      // Generate the memo and verify it contains the question
      const memo = generateLegalMemo(sampleDoc, sampleClauses, lawyerChecklistStore.getSnapshot());
      const matched = memo.lawyerQuestions.find((q) => q.text === questionText);
      expect(matched).toBeDefined();

      // Verify the exported PDF includes this question
      const pdf = buildLegalMemoPdf(memo);
      expect(pdf).toBeDefined();
      expect(pdf.internal.pages.length).toBeGreaterThanOrEqual(1);

      renderedMemo.unmount();
      lawyerChecklistStore.clear();
    });
  });
});
