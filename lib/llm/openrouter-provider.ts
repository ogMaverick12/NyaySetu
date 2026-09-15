import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { type QAResponse } from "@/features/qa-chat/types";
import { type LLMProvider, type ExtractionResponse, type ExtractionOptions } from "./types";
import {
  CLAUSE_EXTRACTION_SYSTEM_INSTRUCTION,
  buildExtractionUserPrompt,
} from "@/features/extraction/services/extraction-prompt";
import { validateAndParseClauses } from "@/features/extraction/services/clause-validator";
import { QA_SYSTEM_INSTRUCTION, buildQAUserPrompt } from "@/features/qa-chat/services/qa-prompt";
import { retrieveRelevantContext } from "@/features/qa-chat/services/rag-retriever";
import { validateAndParseQAResponse } from "@/features/qa-chat/services/qa-validator";

export class OpenRouterProvider implements LLMProvider {
  readonly providerName = "openrouter" as const;
  private readonly apiKey: string | undefined;
  private readonly modelName: string;

  // Model priority (OpenRouter):
  //   1. google/gemini-2.0-flash-001      — stable, fast, multimodal, good OCR + legal reasoning
  //   2. google/gemini-2.0-flash-exp:free — free experimental variant (same capability)
  //   3. google/gemma-3-27b-it:free       — free fallback if Gemini quota exhausted
  //   NOTE: "google/gemini-flash-1.5" is NOT a valid OpenRouter ID.
  //         Correct IDs: google/gemini-1.5-flash, google/gemini-2.0-flash-001
  constructor(
    apiKey?: string,
    modelName = process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-001"
  ) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY;
    this.modelName = modelName;
  }

  async extractClauses(
    doc: ParsedDocument,
    options?: ExtractionOptions
  ): Promise<ExtractionResponse> {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured in environment variables.");
    }

    const startTime = Date.now();
    const url = "https://openrouter.ai/api/v1/chat/completions";

    const systemInstruction = CLAUSE_EXTRACTION_SYSTEM_INSTRUCTION;
    const userPrompt = buildExtractionUserPrompt(doc);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, options?.timeoutMs || 45000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://nyaysetu.local",
          "X-Title": "NyaySetu Legal Assistant",
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: "system",
              content: systemInstruction,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`OpenRouter API returned status ${res.status}: ${errText.slice(0, 300)}`);
      }

      const responseJson = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const rawText = responseJson.choices?.[0]?.message?.content;
      if (!rawText) {
        throw new Error("OpenRouter returned empty message content.");
      }

      const clauses = validateAndParseClauses(rawText);
      const latencyMs = Date.now() - startTime;

      return {
        clauses,
        metadata: {
          provider: "openrouter",
          model: this.modelName,
          latencyMs,
          fallbackTriggered: false,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async answerQuestion(
    doc: ParsedDocument,
    question: string,
    clauses?: Clause[],
    options?: ExtractionOptions
  ): Promise<QAResponse> {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured in environment variables.");
    }

    const startTime = Date.now();
    const url = "https://openrouter.ai/api/v1/chat/completions";

    const relevantChunks = retrieveRelevantContext(doc, question, clauses);
    const systemInstruction = QA_SYSTEM_INSTRUCTION;
    const userPrompt = buildQAUserPrompt(doc, question, relevantChunks, clauses);

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, options?.timeoutMs || 45000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://nyaysetu.local",
          "X-Title": "NyaySetu Legal Assistant",
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: "system",
              content: systemInstruction,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`OpenRouter API returned status ${res.status}: ${errText.slice(0, 300)}`);
      }

      const responseJson = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const rawText = responseJson.choices?.[0]?.message?.content;
      if (!rawText) {
        throw new Error("OpenRouter returned empty message content.");
      }

      const qaPayload = validateAndParseQAResponse(rawText);
      const latencyMs = Date.now() - startTime;

      return {
        ...qaPayload,
        metadata: {
          provider: "openrouter",
          model: this.modelName,
          latencyMs,
          fallbackTriggered: false,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
