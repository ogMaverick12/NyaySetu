import { QAResponseSchema, type QAResponsePayload } from "../types";

/**
 * Validates and parses raw LLM output into a typed QAResponsePayload.
 * Enforces Zod schema compliance before data touches application state.
 */
export function validateAndParseQAResponse(rawContent: string): QAResponsePayload {
  let cleaned = rawContent.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid JSON syntax";
    throw new Error(`LLM Q&A output is not valid JSON: ${message}`);
  }

  // Validate with Zod
  const result = QAResponseSchema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`LLM Q&A output failed Zod schema validation: ${errorDetails}`);
  }

  const payload = result.data;

  // PRD F5 Invariant: If out-of-scope, guarantee lawyerPrepSuggestion and clear statement
  if (!payload.isCovered) {
    if (!payload.lawyerPrepSuggestion) {
      payload.lawyerPrepSuggestion =
        "This question is not covered in the document. We recommend adding it to your Lawyer-Prep Checklist for professional legal advice.";
    }
    if (!payload.answer.toLowerCase().includes("not covered")) {
      payload.answer = "This topic is not covered in the provided document.";
    }
  }

  return payload;
}
