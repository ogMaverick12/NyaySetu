import { describe, it, expect, vi } from "vitest";
import { validateAndParseClauses, ClauseSchema, type Clause } from "@/features/extraction";
import { type LLMProvider, type ExtractionResponse, FallbackLLMProvider } from "@/lib/llm";
import { type ParsedDocument } from "@/features/ingestion/types";

describe("Clause Extraction & Resilient LLM Provider (F2)", () => {
  const sampleParsedDoc: ParsedDocument = {
    id: "doc_test_123",
    filename: "residential-lease-2026.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 24500,
    pageCount: 2,
    pages: [
      {
        pageNumber: 1,
        text: "Tenant shall pay INR 32,000 monthly rent. Deposit is INR 96,000.",
        charCount: 65,
        wordCount: 11,
      },
      {
        pageNumber: 2,
        text: "Lessor may terminate with 15 days notice; Lessee must provide 60 days.",
        charCount: 71,
        wordCount: 12,
      },
    ],
    fullText: "Tenant shall pay rent...",
    isOcr: false,
    createdAt: new Date().toISOString(),
  };

  const validClausesRawJson = JSON.stringify({
    clauses: [
      {
        id: "cl_1",
        page: 1,
        sourceText: "Tenant shall pay INR 32,000 monthly rent.",
        type: "rent_payment",
        plainSummary: "Rent is due monthly at INR 32,000.",
        riskLevel: "info",
        rationale: "Customary and standard rental payment term.",
      },
      {
        id: "cl_2",
        page: 2,
        sourceText: "Lessor may terminate with 15 days notice; Lessee must provide 60 days.",
        type: "termination_notice",
        plainSummary: "Landlord can terminate in 15 days while you must give 60 days.",
        riskLevel: "caution",
        rationale: "Unbalanced notice period favoring the landlord.",
      },
      {
        id: "cl_3",
        page: 2,
        sourceText: "Partner shall indemnify Company for all third party claims without cap.",
        type: "indemnity_liability",
        plainSummary: "You bear unlimited financial responsibility for any third-party claims.",
        riskLevel: "high-risk",
        rationale: "Severe uncapped liability without reciprocal obligation.",
      },
    ],
  });

  describe("Zod Validation (validateAndParseClauses)", () => {
    it("should parse and validate valid structured JSON matching 02-TRD.md schema", () => {
      const clauses = validateAndParseClauses(validClausesRawJson);

      expect(clauses.length).toBe(3);
      expect(clauses[0].id).toBe("cl_1");
      expect(clauses[0].riskLevel).toBe("info");
      expect(clauses[1].riskLevel).toBe("caution");
      expect(clauses[2].riskLevel).toBe("high-risk");

      // Verify each conforms strictly to ClauseSchema
      clauses.forEach((c) => {
        expect(() => ClauseSchema.parse(c)).not.toThrow();
      });
    });

    it("should clean markdown code fences (```json ... ```) returned by LLMs", () => {
      const fencedJson = "```json\n" + validClausesRawJson + "\n```";
      const clauses = validateAndParseClauses(fencedJson);
      expect(clauses.length).toBe(3);
    });

    it("should reject responses with invalid risk levels", () => {
      const invalidRiskJson = JSON.stringify({
        clauses: [
          {
            id: "cl_bad",
            page: 1,
            sourceText: "Sample",
            type: "test",
            plainSummary: "Sample summary",
            riskLevel: "dangerous", // Invalid per enum ('info' | 'caution' | 'high-risk')
            rationale: "Bad risk tag",
          },
        ],
      });

      expect(() => validateAndParseClauses(invalidRiskJson)).toThrowError(
        /Clause schema validation failed/
      );
    });

    it("should reject responses missing required fields", () => {
      const missingPageJson = JSON.stringify({
        clauses: [
          {
            id: "cl_bad",
            // missing page
            sourceText: "Sample",
            type: "test",
            plainSummary: "Sample summary",
            riskLevel: "info",
            rationale: "Missing page",
          },
        ],
      });

      expect(() => validateAndParseClauses(missingPageJson)).toThrowError(
        /Clause schema validation failed/
      );
    });
  });

  describe("LLM Provider Resilience & Fallback (FallbackLLMProvider)", () => {
    it("should return Gemini result when Gemini succeeds", async () => {
      const mockGeminiClauses: Clause[] = [
        {
          id: "gemini_1",
          page: 1,
          sourceText: "Deposit clause",
          type: "security_deposit",
          plainSummary: "Standard deposit",
          riskLevel: "info",
          rationale: "Fair terms",
        },
      ];

      const mockGemini: LLMProvider = {
        providerName: "gemini",
        extractClauses: vi.fn().mockResolvedValue({
          clauses: mockGeminiClauses,
          metadata: {
            provider: "gemini",
            model: "gemini-1.5-flash",
            latencyMs: 1200,
            fallbackTriggered: false,
          },
        } satisfies ExtractionResponse),
        answerQuestion: vi.fn(),
        generateNegotiationEmail: vi.fn(),
      };

      const openRouterSpy = vi.fn();
      const mockOpenRouter: LLMProvider = {
        providerName: "openrouter",
        extractClauses: openRouterSpy,
        answerQuestion: vi.fn(),
        generateNegotiationEmail: vi.fn(),
      };

      const fallbackProvider = new FallbackLLMProvider(mockGemini, mockOpenRouter);
      const result = await fallbackProvider.extractClauses(sampleParsedDoc);

      expect(result.clauses).toEqual(mockGeminiClauses);
      expect(result.metadata.provider).toBe("gemini");
      expect(result.metadata.fallbackTriggered).toBe(false);
      expect(openRouterSpy).not.toHaveBeenCalled();
    });

    it("should automatically fall back to OpenRouter when Gemini fails and record provenance", async () => {
      const mockOpenRouterClauses: Clause[] = [
        {
          id: "openrouter_1",
          page: 1,
          sourceText: "Termination clause",
          type: "termination",
          plainSummary: "Immediate termination",
          riskLevel: "high-risk",
          rationale: "Unilateral termination",
        },
      ];

      const mockGemini: LLMProvider = {
        providerName: "gemini",
        extractClauses: vi.fn().mockRejectedValue(new Error("Gemini 429: Resource exhausted")),
        answerQuestion: vi.fn(),
        generateNegotiationEmail: vi.fn(),
      };

      const openRouterSpy = vi.fn().mockResolvedValue({
        clauses: mockOpenRouterClauses,
        metadata: {
          provider: "openrouter",
          model: "meta-llama/llama-3.3-70b-instruct",
          latencyMs: 2400,
          fallbackTriggered: false,
        },
      } satisfies ExtractionResponse);

      const mockOpenRouter: LLMProvider = {
        providerName: "openrouter",
        extractClauses: openRouterSpy,
        answerQuestion: vi.fn(),
        generateNegotiationEmail: vi.fn(),
      };

      const fallbackProvider = new FallbackLLMProvider(mockGemini, mockOpenRouter);
      const result = await fallbackProvider.extractClauses(sampleParsedDoc);

      expect(result.clauses).toEqual(mockOpenRouterClauses);
      expect(result.metadata.provider).toBe("openrouter");
      expect(result.metadata.fallbackTriggered).toBe(true);
      expect(result.metadata.fallbackReason).toContain("Gemini 429");
      expect(openRouterSpy).toHaveBeenCalledOnce();
    });

    it("should throw informative error if both primary and fallback fail", async () => {
      const mockGemini: LLMProvider = {
        providerName: "gemini",
        extractClauses: vi.fn().mockRejectedValue(new Error("Gemini quota error")),
        answerQuestion: vi.fn(),
        generateNegotiationEmail: vi.fn(),
      };

      const mockOpenRouter: LLMProvider = {
        providerName: "openrouter",
        extractClauses: vi.fn().mockRejectedValue(new Error("OpenRouter timeout")),
        answerQuestion: vi.fn(),
        generateNegotiationEmail: vi.fn(),
      };

      const fallbackProvider = new FallbackLLMProvider(mockGemini, mockOpenRouter);

      await expect(fallbackProvider.extractClauses(sampleParsedDoc)).rejects.toThrow(
        /Both LLM providers failed/
      );
    });
  });
});
