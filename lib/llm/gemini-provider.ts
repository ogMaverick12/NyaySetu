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

export class GeminiProvider implements LLMProvider {
  readonly providerName = "gemini" as const;
  private readonly apiKey: string | undefined;
  private readonly modelName: string;

  constructor(apiKey?: string, modelName = "gemini-1.5-flash") {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    this.modelName = modelName;
  }

  async extractClauses(
    doc: ParsedDocument,
    options?: ExtractionOptions
  ): Promise<ExtractionResponse> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables.");
    }

    const startTime = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

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
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Gemini API returned status ${res.status}: ${errText.slice(0, 300)}`);
      }

      const responseJson = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error("Gemini returned empty or missing content candidate.");
      }

      const clauses = validateAndParseClauses(rawText);
      const latencyMs = Date.now() - startTime;

      return {
        clauses,
        metadata: {
          provider: "gemini",
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
      throw new Error("GEMINI_API_KEY is not configured in environment variables.");
    }

    const startTime = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

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
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Gemini API returned status ${res.status}: ${errText.slice(0, 300)}`);
      }

      const responseJson = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const rawText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error("Gemini returned empty or missing content candidate.");
      }

      const qaPayload = validateAndParseQAResponse(rawText);
      const latencyMs = Date.now() - startTime;

      return {
        ...qaPayload,
        metadata: {
          provider: "gemini",
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
