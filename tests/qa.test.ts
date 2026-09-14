import { describe, it, expect, vi } from "vitest";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import {
  chunkDocument,
  retrieveRelevantContext,
  evaluateDeterministicQA,
} from "@/features/qa-chat/services/rag-retriever";
import { validateAndParseQAResponse } from "@/features/qa-chat/services/qa-validator";
import { FallbackLLMProvider } from "@/lib/llm/fallback-provider";
import { type LLMProvider } from "@/lib/llm/types";

// Mock Sample Document
const mockTenancyDoc: ParsedDocument = {
  id: "doc_test_1",
  filename: "Rental_Agreement_2024.pdf",
  mimeType: "application/pdf",
  fileSizeBytes: 12400,
  pageCount: 2,
  createdAt: "2026-09-14T10:00:00Z",
  fullText: `RESIDENTIAL LEASE AGREEMENT
Page 1:
Clause 3. Security Deposit: The Tenant shall deposit an amount of Rs. 96,000/- equivalent to 3 months rent as an interest-free refundable security deposit.
The deposit shall be refunded within 30 days of vacating the premises after deducting dues.

Page 2:
Clause 8. Termination and Notice Period: Either party may terminate this agreement by providing notice.
The Landlord may terminate with 15 days written notice, whereas the Tenant must provide at least 60 days prior written notice.`,
  pages: [
    {
      pageNumber: 1,
      text: "RESIDENTIAL LEASE AGREEMENT\nClause 3. Security Deposit: The Tenant shall deposit an amount of Rs. 96,000/- equivalent to 3 months rent as an interest-free refundable security deposit. The deposit shall be refunded within 30 days of vacating the premises after deducting dues.",
      charCount: 240,
      wordCount: 42,
    },
    {
      pageNumber: 2,
      text: "Clause 8. Termination and Notice Period: Either party may terminate this agreement by providing notice. The Landlord may terminate with 15 days written notice, whereas the Tenant must provide at least 60 days prior written notice.",
      charCount: 190,
      wordCount: 35,
    },
  ],
  isOcr: false,
};

const mockClauses: Clause[] = [
  {
    id: "cl_1",
    page: 1,
    sourceText:
      "The Tenant shall deposit an amount of Rs. 96,000/- equivalent to 3 months rent as an interest-free refundable security deposit.",
    type: "security_deposit",
    plainSummary: "Tenant pays 3 months deposit of Rs 96,000 refundable on exit.",
    riskLevel: "caution",
    rationale: "Exceeds standard 2-month deposit benchmark.",
  },
  {
    id: "cl_2",
    page: 2,
    sourceText:
      "The Landlord may terminate with 15 days written notice, whereas the Tenant must provide at least 60 days prior written notice.",
    type: "termination_notice",
    plainSummary: "Landlord gets 15-day exit notice while tenant must give 60 days.",
    riskLevel: "high-risk",
    rationale: "Severely asymmetric notice requirement.",
  },
];

describe("Grounded Document Consultation Q&A (PRD F5)", () => {
  describe("RAG Document Chunking & Keyword Retrieval", () => {
    it("should chunk document pages and preserve page anchors", () => {
      const chunks = chunkDocument(mockTenancyDoc);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].page).toBe(1);
      expect(chunks[chunks.length - 1].page).toBe(2);
    });

    it("should retrieve relevant chunks based on query keywords", () => {
      const retrieved = retrieveRelevantContext(
        mockTenancyDoc,
        "What is the security deposit refund terms?",
        mockClauses
      );
      expect(retrieved.length).toBeGreaterThan(0);
      expect(retrieved[0].text.toLowerCase()).toContain("deposit");
    });
  });

  describe("Deterministic Consultation Engine & Scope Enforcement", () => {
    it("should answer in-scope question regarding deposit and cite page 1", () => {
      const res = evaluateDeterministicQA(
        mockTenancyDoc,
        "How much security deposit do I need to pay?",
        mockClauses
      );

      expect(res.isCovered).toBe(true);
      expect(res.citations.length).toBeGreaterThan(0);
      expect(res.citations[0].page).toBe(1);
      expect(res.citations[0].excerpt).toContain("96,000");
    });

    it("should answer in-scope question regarding termination notice and cite page 2", () => {
      const res = evaluateDeterministicQA(
        mockTenancyDoc,
        "What is the notice period for terminating the lease?",
        mockClauses
      );

      expect(res.isCovered).toBe(true);
      expect(res.citations.length).toBeGreaterThan(0);
      expect(res.citations[0].page).toBe(2);
      expect(res.citations[0].excerpt).toContain("15 days");
    });

    it("should strictly reject out-of-scope questions with not-covered notice and lawyer suggestion", () => {
      const outOfScopeQuery = "Can I sue my employer for wrongful termination under criminal code?";
      const res = evaluateDeterministicQA(mockTenancyDoc, outOfScopeQuery, mockClauses);

      expect(res.isCovered).toBe(false);
      expect(res.answer).toContain("not covered in the provided document");
      expect(res.citations).toHaveLength(0);
      expect(res.lawyerPrepSuggestion).toBeDefined();
      expect(res.lawyerPrepSuggestion).toContain("Lawyer-Prep Checklist");
    });
  });

  describe("Q&A Response Schema Validation (Zod)", () => {
    it("should validate and clean JSON wrapped in markdown fences", () => {
      const rawJson = `\`\`\`json
{
  "isCovered": true,
  "answer": "The deposit is 3 months rent.",
  "citations": [
    {
      "page": 1,
      "clauseId": "cl_1",
      "clauseTitle": "Security Deposit",
      "excerpt": "Rs. 96,000/- equivalent to 3 months rent"
    }
  ]
}
\`\`\``;

      const parsed = validateAndParseQAResponse(rawJson);
      expect(parsed.isCovered).toBe(true);
      expect(parsed.citations[0].page).toBe(1);
      expect(parsed.citations[0].excerpt).toContain("96,000");
    });

    it("should reject invalid Q&A payload without answer", () => {
      const invalidJson = JSON.stringify({
        isCovered: true,
        citations: [],
      });

      expect(() => validateAndParseQAResponse(invalidJson)).toThrow(
        /failed Zod schema validation/i
      );
    });

    it("should enforce lawyerPrepSuggestion on out-of-scope response", () => {
      const outOfScopeJson = JSON.stringify({
        isCovered: false,
        answer: "This is not in the document.",
        citations: [],
      });

      const parsed = validateAndParseQAResponse(outOfScopeJson);
      expect(parsed.isCovered).toBe(false);
      expect(parsed.lawyerPrepSuggestion).toBeDefined();
    });
  });

  describe("LLM Provider Resilience & Fallback for Q&A", () => {
    it("should fall back to secondary provider if primary answerQuestion fails", async () => {
      const primaryMock: LLMProvider = {
        providerName: "gemini",
        extractClauses: vi.fn(),
        answerQuestion: vi.fn().mockRejectedValue(new Error("Gemini 429 quota exhausted")),
      };

      const fallbackMock: LLMProvider = {
        providerName: "openrouter",
        extractClauses: vi.fn(),
        answerQuestion: vi.fn().mockResolvedValue({
          isCovered: true,
          answer: "The notice period is 15 days for landlord and 60 days for tenant.",
          citations: [{ page: 2, excerpt: "15 days written notice" }],
          metadata: {
            provider: "openrouter" as const,
            model: "meta-llama/llama-3.3-70b-instruct",
            latencyMs: 310,
            fallbackTriggered: false,
          },
        }),
      };

      const resilient = new FallbackLLMProvider(primaryMock, fallbackMock);
      const res = await resilient.answerQuestion(mockTenancyDoc, "What is the notice period?");

      expect(res.isCovered).toBe(true);
      expect(res.metadata.provider).toBe("openrouter");
      expect(res.metadata.fallbackTriggered).toBe(true);
      expect(res.metadata.fallbackReason).toContain("Gemini 429");
    });
  });
});
