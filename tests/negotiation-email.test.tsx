import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  NegotiationEmailDraftSchema,
  type NegotiationEmailDraft,
  type NegotiationEmailPromptInput,
} from "@/features/negotiation-email/types";
import {
  buildNegotiationEmailUserPrompt,
  extractPartiesAndPremisesSummary,
  NEGOTIATION_EMAIL_SYSTEM_INSTRUCTION,
} from "@/features/negotiation-email/services/negotiation-prompt";
import {
  validateAndParseNegotiationEmail,
  cleanRawJsonText,
  sanitizePlainText,
} from "@/features/negotiation-email/services/negotiation-validator";
import { negotiationEmailStore } from "@/features/negotiation-email/store/negotiation-email-store";
import { NegotiationEmailWorkspace } from "@/features/negotiation-email/components/negotiation-email-workspace";
import { type Clause } from "@/features/extraction/types";
import { type ComparisonDifference } from "@/features/compare/types";
import { type LLMProvider, FallbackLLMProvider } from "@/lib/llm";

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

describe("Negotiation Email Feature Suite (02-TRD.md & UIUX Brief)", () => {
  const sampleClauses: Clause[] = [
    {
      id: "cl_standard_1",
      page: 1,
      type: "RENT_PAYMENT",
      sourceText: "Rent of INR 25,000 shall be paid by the 5th of each calendar month.",
      plainSummary: "Monthly rent is INR 25,000 payable on 5th.",
      riskLevel: "info",
      rationale: "Standard payment obligation",
    },
    {
      id: "cl_high_1",
      page: 2,
      type: "TERMINATION_NOTICE",
      sourceText: "Lessor may terminate this tenancy with 7 days notice without assigning reason.",
      plainSummary: "Landlord can terminate in 7 days without cause.",
      riskLevel: "high-risk",
      rationale: "Extreme one-sided notice asymmetry.",
    },
    {
      id: "cl_caution_1",
      page: 3,
      type: "LOCK_IN",
      sourceText:
        "Tenant agrees to a 24-month lock-in period with full deposit forfeiture on early exit.",
      plainSummary: "24-month lock-in forfeiting full deposit if vacating earlier.",
      riskLevel: "caution",
      rationale: "Onerous lock-in restriction.",
    },
  ];

  const sampleDiffs: ComparisonDifference[] = [
    {
      id: "diff_1",
      clauseType: "TERMINATION_NOTICE",
      title: "Notice Disparity",
      baseText: "Minimum 60 days notice for residential tenancies.",
      targetText: "7 days notice by landlord.",
      impactOnUser: "disadvantageous",
      explanation: "Falls significantly short of statutory recommendation.",
      severity: "high",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSpeaking = false;
    negotiationEmailStore.clear();
  });

  describe("1. Zod Validation & Text Sanitization", () => {
    const validDraft: NegotiationEmailDraft = {
      subject: "Proposed Amendments to Residential Lease Agreement - Flat 402",
      body: "Dear Landlord,\n\nThank you for sharing the draft agreement. We request an equal 60-day reciprocal notice period and adjustments to the lock-in clause.",
      citedClauseIds: ["cl_high_1", "cl_caution_1"],
    };

    it("validates valid JSON output conforming to NegotiationEmailDraftSchema", () => {
      const rawJson = JSON.stringify(validDraft);
      const parsed = validateAndParseNegotiationEmail(rawJson);

      expect(parsed.subject).toBe(validDraft.subject);
      expect(parsed.body).toBe(validDraft.body);
      expect(parsed.citedClauseIds).toEqual(["cl_high_1", "cl_caution_1"]);
      expect(() => NegotiationEmailDraftSchema.parse(parsed)).not.toThrow();
    });

    it("cleans markdown code fences (```json ... ```) produced by LLMs", () => {
      const fenced = "```json\n" + JSON.stringify(validDraft) + "\n```";
      expect(cleanRawJsonText(fenced)).toBe(JSON.stringify(validDraft));
      const parsed = validateAndParseNegotiationEmail(fenced);
      expect(parsed.subject).toBe(validDraft.subject);
    });

    it("extracts parties and premises summary from captured clauses", () => {
      const summary = extractPartiesAndPremisesSummary(sampleClauses);
      expect(summary).toContain("Landlord can terminate");
    });

    it("sanitizes plain text to prevent raw HTML/script injection", () => {
      const dangerousText = "Subject with <script>alert('xss')</script> and <b>bold</b> elements";
      const sanitized = sanitizePlainText(dangerousText);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("</script>");
      expect(sanitized).not.toContain("<b>");
    });

    it("throws a descriptive error on invalid or missing schema fields", () => {
      const missingBodyJson = JSON.stringify({
        subject: "Subject only",
        // missing body
        citedClauseIds: [],
      });

      expect(() => validateAndParseNegotiationEmail(missingBodyJson)).toThrow(
        /Negotiation email schema validation failed/
      );
    });
  });

  describe("2. Token Efficiency & Domain Vocabulary Prompting", () => {
    it("includes ONLY high-risk and caution clauses, omitting standard/info clauses", () => {
      const promptInput: NegotiationEmailPromptInput = {
        documentType: "tenancy",
        documentFilename: "lease-agreement.pdf",
        clauses: sampleClauses,
        comparisonDifferences: sampleDiffs,
      };

      const prompt = buildNegotiationEmailUserPrompt(promptInput);

      // High-risk and caution clauses MUST be present
      expect(prompt).toContain("cl_high_1");
      expect(prompt).toContain("cl_caution_1");

      // Low-risk standard clause MUST NOT be included to preserve tokens
      expect(prompt).not.toContain("cl_standard_1");
      expect(prompt).not.toContain("Standard payment obligation");
    });

    it("does not include raw full document text in the prompt context", () => {
      const promptInput: NegotiationEmailPromptInput = {
        documentType: "tenancy",
        documentFilename: "lease-agreement.pdf",
        clauses: sampleClauses,
      };

      const prompt = buildNegotiationEmailUserPrompt(promptInput);
      expect(prompt).not.toContain("fullText");
    });

    it("enforces tenancy-specific vocabulary in the system instruction", () => {
      expect(NEGOTIATION_EMAIL_SYSTEM_INSTRUCTION).toContain("tenant");
      expect(NEGOTIATION_EMAIL_SYSTEM_INSTRUCTION).toContain("landlord");
      expect(NEGOTIATION_EMAIL_SYSTEM_INSTRUCTION).toContain("premises");
      expect(NEGOTIATION_EMAIL_SYSTEM_INSTRUCTION).toContain("DO NOT use gig or employment terms");
    });
  });

  describe("3. Resilient Fallback LLM Provider (Gemini -> OpenRouter)", () => {
    const mockDraft: NegotiationEmailDraft = {
      subject: "Discussion on Tenancy Terms",
      body: "We request mutual adjustments.",
      citedClauseIds: ["cl_high_1"],
    };

    const promptInput: NegotiationEmailPromptInput = {
      documentType: "tenancy",
      documentFilename: "lease.pdf",
      clauses: sampleClauses,
    };

    it("returns Gemini result when Gemini succeeds", async () => {
      const mockGemini: LLMProvider = {
        providerName: "gemini",
        extractClauses: vi.fn(),
        answerQuestion: vi.fn(),
        generateNegotiationEmail: vi.fn().mockResolvedValue({
          draft: mockDraft,
          metadata: {
            provider: "gemini",
            model: "gemini-2.5-flash",
            latencyMs: 950,
            fallbackTriggered: false,
          },
        }),
      };

      const openRouterSpy = vi.fn();
      const mockOpenRouter: LLMProvider = {
        providerName: "openrouter",
        extractClauses: vi.fn(),
        answerQuestion: vi.fn(),
        generateNegotiationEmail: openRouterSpy,
      };

      const fallbackProvider = new FallbackLLMProvider(mockGemini, mockOpenRouter);
      const res = await fallbackProvider.generateNegotiationEmail(promptInput);

      expect(res.draft).toEqual(mockDraft);
      expect(res.metadata.provider).toBe("gemini");
      expect(res.metadata.fallbackTriggered).toBe(false);
      expect(openRouterSpy).not.toHaveBeenCalled();
    });

    it("automatically engages OpenRouter when Gemini fails with 429", async () => {
      const mockGemini: LLMProvider = {
        providerName: "gemini",
        extractClauses: vi.fn(),
        answerQuestion: vi.fn(),
        generateNegotiationEmail: vi
          .fn()
          .mockRejectedValue(new Error("Gemini 429: Quota exhausted")),
      };

      const openRouterDraft: NegotiationEmailDraft = {
        subject: "OpenRouter Tenancy Discussion",
        body: "OpenRouter generated negotiation body.",
        citedClauseIds: ["cl_high_1"],
      };

      const mockOpenRouter: LLMProvider = {
        providerName: "openrouter",
        extractClauses: vi.fn(),
        answerQuestion: vi.fn(),
        generateNegotiationEmail: vi.fn().mockResolvedValue({
          draft: openRouterDraft,
          metadata: {
            provider: "openrouter",
            model: "google/gemma-3-27b-it:free",
            latencyMs: 1400,
            fallbackTriggered: false,
          },
        }),
      };

      const fallbackProvider = new FallbackLLMProvider(mockGemini, mockOpenRouter);
      const res = await fallbackProvider.generateNegotiationEmail(promptInput);

      expect(res.draft.subject).toBe("OpenRouter Tenancy Discussion");
      expect(res.metadata.provider).toBe("openrouter");
      expect(res.metadata.fallbackTriggered).toBe(true);
      expect(res.metadata.fallbackReason).toContain("Gemini 429");
    });
  });

  describe("4. Session Store Caching", () => {
    it("caches generated draft by document key and avoids regeneration", () => {
      const draft: NegotiationEmailDraft = {
        subject: "Cached Subject",
        body: "Cached Body Text",
        citedClauseIds: ["c1"],
      };

      expect(negotiationEmailStore.getDraft("doc-123.pdf")).toBeNull();

      negotiationEmailStore.setDraft("doc-123.pdf", draft);
      expect(negotiationEmailStore.getDraft("doc-123.pdf")).toEqual(draft);

      negotiationEmailStore.clear();
      expect(negotiationEmailStore.getDraft("doc-123.pdf")).toBeNull();
    });
  });

  describe("5. React Workspace UI & Accessibility", () => {
    const mockApiResponse: NegotiationEmailDraft = {
      subject: "Proposed Adjustments to Lease Agreement - Flat 101",
      body: "Dear Landlord,\n\nThank you for providing the lease agreement. I would appreciate if we could adjust the 7-day notice period to a reciprocal 30-day notice.\n\nBest regards,\nTenant",
      citedClauseIds: ["cl_high_1", "cl_caution_1"],
    };

    beforeEach(() => {
      // Mock global fetch for /api/negotiation-email
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: () => Promise.resolve({ draft: mockApiResponse }),
      } as unknown as Response);
    });

    it("renders keyboard-editable textarea and inputs with valid labels", async () => {
      render(
        <NegotiationEmailWorkspace
          documentFilename="sample-lease.pdf"
          documentType="tenancy"
          clauses={sampleClauses}
        />
      );

      // Wait for draft to populate from API
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Proposed Adjustments to Lease Agreement/i)).toBeDefined();
      });

      const subjectInput = screen.getByLabelText(/Email Subject/i);
      const bodyTextarea = screen.getByLabelText(/Message Body \(Keyboard-Editable\)/i);

      expect(subjectInput).toBeDefined();
      expect(bodyTextarea).toBeDefined();
      expect(bodyTextarea.tagName).toBe("TEXTAREA");

      // Verify user can edit the text directly
      fireEvent.change(bodyTextarea, {
        target: { value: "User modified negotiation message body." },
      });

      expect(screen.getByDisplayValue("User modified negotiation message body.")).toBeDefined();
    });

    it("generates safe mailto link requiring explicit click (no auto-send)", async () => {
      render(
        <NegotiationEmailWorkspace
          documentFilename="sample-lease.pdf"
          documentType="tenancy"
          clauses={sampleClauses}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Open in Mail Client/i)).toBeDefined();
      });

      const mailtoLink = screen.getByRole("link", { name: /Open draft in default mail client/i });
      const href = mailtoLink.getAttribute("href") || "";

      expect(href.startsWith("mailto:?subject=")).toBe(true);
      expect(href).toContain("Proposed%20Adjustments");
      expect(href).toContain("body=");
    });

    it("triggers speech synthesis when clicking Read Draft", async () => {
      render(
        <NegotiationEmailWorkspace
          documentFilename="sample-lease.pdf"
          documentType="tenancy"
          clauses={sampleClauses}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Read draft email aloud/i })).toBeDefined();
      });

      const voiceBtn = screen.getByRole("button", { name: /Read draft email aloud/i });
      fireEvent.click(voiceBtn);

      expect(mockSpeak).toHaveBeenCalledTimes(1);
      expect(mockSpeak.mock.calls[0][0]).toContain("Subject: Proposed Adjustments");
      expect(mockSpeak.mock.calls[0][0]).toContain("adjust the 7-day notice");
    });
  });
});
