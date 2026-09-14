import { type Clause, ClauseExtractionOutputSchema } from "../types";

/**
 * Strips markdown code fences from LLM responses if present.
 */
export function cleanJsonString(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

/**
 * Validates and sanitizes raw LLM output against the Zod schema before it touches app state.
 * Throws an Error if the output fails validation.
 */
export function validateAndParseClauses(rawOutput: string): Clause[] {
  const cleaned = cleanJsonString(rawOutput);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid JSON";
    throw new Error(`LLM output could not be parsed as JSON: ${msg}`);
  }

  // Handle case where LLM directly returns an array of clauses
  let targetObject: unknown = parsedJson;
  if (Array.isArray(parsedJson)) {
    targetObject = { clauses: parsedJson };
  }

  const result = ClauseExtractionOutputSchema.safeParse(targetObject);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Clause schema validation failed: ${errorDetails}`);
  }

  return result.data.clauses;
}
