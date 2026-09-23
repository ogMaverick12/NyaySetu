import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { type QAResponse } from "@/features/qa-chat/types";
import {
  type NegotiationEmailPromptInput,
  type NegotiationEmailResponse,
} from "@/features/negotiation-email/types";
import { type LLMProvider, type ExtractionResponse, type ExtractionOptions } from "./types";
import { securityLogger } from "@/lib/security";

export class FallbackLLMProvider implements LLMProvider {
  readonly providerName = "resilient-fallback" as const;
  private readonly primary: LLMProvider;
  private readonly fallback: LLMProvider;

  constructor(primary: LLMProvider, fallback: LLMProvider) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async extractClauses(
    doc: ParsedDocument,
    options?: ExtractionOptions
  ): Promise<ExtractionResponse> {
    try {
      const primaryResponse = await this.primary.extractClauses(doc, options);
      return primaryResponse;
    } catch (primaryErr: unknown) {
      const errorMsg = primaryErr instanceof Error ? primaryErr.message : "Primary provider failed";

      // Security rule from 02-TRD.md: No document content in logs or analytics
      securityLogger.warn("LLM_PRIMARY_PROVIDER_FAILED", {
        primary: this.primary.providerName,
        fallbackProvider: this.fallback.providerName,
        reason: errorMsg,
        operation: "extractClauses",
      });

      try {
        const fallbackResponse = await this.fallback.extractClauses(doc, options);
        return {
          ...fallbackResponse,
          metadata: {
            ...fallbackResponse.metadata,
            fallbackTriggered: true,
            fallbackReason: errorMsg,
          },
        };
      } catch (fallbackErr: unknown) {
        const fallbackMsg =
          fallbackErr instanceof Error ? fallbackErr.message : "Fallback provider failed";

        throw new Error(
          `Both LLM providers failed. Primary (${this.primary.providerName}): ${errorMsg}. Fallback (${this.fallback.providerName}): ${fallbackMsg}`
        );
      }
    }
  }

  async answerQuestion(
    doc: ParsedDocument,
    question: string,
    clauses?: Clause[],
    options?: ExtractionOptions
  ): Promise<QAResponse> {
    try {
      const primaryResponse = await this.primary.answerQuestion(doc, question, clauses, options);
      return primaryResponse;
    } catch (primaryErr: unknown) {
      const errorMsg = primaryErr instanceof Error ? primaryErr.message : "Primary provider failed";

      // Security rule from 02-TRD.md: No document content in logs or analytics
      securityLogger.warn("LLM_PRIMARY_PROVIDER_FAILED", {
        primary: this.primary.providerName,
        fallbackProvider: this.fallback.providerName,
        reason: errorMsg,
        operation: "answerQuestion",
      });

      try {
        const fallbackResponse = await this.fallback.answerQuestion(
          doc,
          question,
          clauses,
          options
        );
        return {
          ...fallbackResponse,
          metadata: {
            ...fallbackResponse.metadata,
            fallbackTriggered: true,
            fallbackReason: errorMsg,
          },
        };
      } catch (fallbackErr: unknown) {
        const fallbackMsg =
          fallbackErr instanceof Error ? fallbackErr.message : "Fallback provider failed";

        throw new Error(
          `Both LLM providers failed. Primary (${this.primary.providerName}): ${errorMsg}. Fallback (${this.fallback.providerName}): ${fallbackMsg}`
        );
      }
    }
  }

  async generateNegotiationEmail(
    input: NegotiationEmailPromptInput,
    options?: ExtractionOptions
  ): Promise<NegotiationEmailResponse> {
    try {
      const primaryResponse = await this.primary.generateNegotiationEmail(input, options);
      return primaryResponse;
    } catch (primaryErr: unknown) {
      const errorMsg = primaryErr instanceof Error ? primaryErr.message : "Primary provider failed";

      // Security rule from 02-TRD.md: No document content in logs or analytics
      securityLogger.warn("LLM_PRIMARY_PROVIDER_FAILED", {
        primary: this.primary.providerName,
        fallbackProvider: this.fallback.providerName,
        reason: errorMsg,
        operation: "generateNegotiationEmail",
      });

      try {
        const fallbackResponse = await this.fallback.generateNegotiationEmail(input, options);
        return {
          ...fallbackResponse,
          metadata: {
            ...fallbackResponse.metadata,
            fallbackTriggered: true,
            fallbackReason: errorMsg,
          },
        };
      } catch (fallbackErr: unknown) {
        const fallbackMsg =
          fallbackErr instanceof Error ? fallbackErr.message : "Fallback provider failed";

        throw new Error(
          `Both LLM providers failed. Primary (${this.primary.providerName}): ${errorMsg}. Fallback (${this.fallback.providerName}): ${fallbackMsg}`
        );
      }
    }
  }
}
