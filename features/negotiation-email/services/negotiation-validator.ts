import { NegotiationEmailDraftSchema, type NegotiationEmailDraft } from "../types";

/**
 * Strips markdown code blocks and backticks from raw LLM output.
 */
export function cleanRawJsonText(rawText: string): string {
  let cleaned = rawText.trim();
  // Strip leading ```json or ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  // Strip trailing ```
  cleaned = cleaned.replace(/\s*```$/i, "");
  return cleaned.trim();
}

/**
 * Sanitizes plain text content from LLM output to prevent HTML injection
 * when exported or rendered.
 */
export function sanitizePlainText(text: string): string {
  if (!text) return "";
  // Strip any raw HTML tags (e.g. <script>, <iframe>, <img ...>)
  return text.replace(/<[^>]*>/g, "").trim();
}

/**
 * Parses and validates raw LLM response against NegotiationEmailDraftSchema.
 * Throws a descriptive error if the output does not conform to the schema.
 */
export function validateAndParseNegotiationEmail(rawText: string): NegotiationEmailDraft {
  const cleaned = cleanRawJsonText(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Failed to parse negotiation email JSON: ${err instanceof Error ? err.message : "Malformed JSON response"}`
    );
  }

  const result = NegotiationEmailDraftSchema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new Error(`Negotiation email schema validation failed: ${errorDetails}`);
  }

  return {
    subject: sanitizePlainText(result.data.subject),
    body: sanitizePlainText(result.data.body),
    citedClauseIds: result.data.citedClauseIds,
  };
}
