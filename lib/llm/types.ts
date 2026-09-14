import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { type QAResponse } from "@/features/qa-chat/types";

export interface ExtractionOptions {
  maxRetries?: number;
  timeoutMs?: number;
}

export type LLMProviderName = "gemini" | "openrouter";

export interface ExtractionResultMetadata {
  provider: LLMProviderName;
  model: string;
  latencyMs: number;
  fallbackTriggered: boolean;
  fallbackReason?: string | null;
}

export interface ExtractionResponse {
  clauses: Clause[];
  metadata: ExtractionResultMetadata;
}

export interface LLMProvider {
  readonly providerName: LLMProviderName | "resilient-fallback";
  extractClauses(doc: ParsedDocument, options?: ExtractionOptions): Promise<ExtractionResponse>;
  answerQuestion(
    doc: ParsedDocument,
    question: string,
    clauses?: Clause[],
    options?: ExtractionOptions
  ): Promise<QAResponse>;
}
