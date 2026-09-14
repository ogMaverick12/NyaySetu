import { type PageContent, type ParsedDocument, ParsedDocumentSchema } from "../types";

/**
 * Normalizes raw string input extracted from PDF pages or OCR.
 * Removes OCR line-wrap hyphens, fixes non-standard spaces, and collapses excessive whitespace.
 */
export function cleanRawText(raw: string): string {
  if (!raw) return "";

  return (
    raw
      // Normalize line breaks
      .replace(/\r\n|\r/g, "\n")
      // Remove null characters and non-printable controls (keep \n and \t)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      // Fix broken words split across line-ends: e.g. "agree-\nment" -> "agreement"
      .replace(/(\b[A-Za-z]+)-\n([A-Za-z]+\b)/g, "$1$2")
      // Normalize non-breaking spaces and special spaces
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
      // Replace excessive horizontal spacing within lines
      .replace(/[ \t]+/g, " ")
      // Trim spaces around line ends
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      // Collapse 3 or more consecutive newlines to double newline (paragraph break)
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Counts words in normalized text safely.
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

export interface RawPageInput {
  pageNumber: number;
  text: string;
}

export interface BuildParsedDocumentParams {
  id?: string;
  filename: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/jpg";
  fileSizeBytes: number;
  rawPages: RawPageInput[];
  isOcr: boolean;
}

/**
 * Normalizes an array of raw page texts into a validated ParsedDocument with page anchors.
 */
export function normalizeDocument(params: BuildParsedDocumentParams): ParsedDocument {
  const {
    id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    filename,
    mimeType,
    fileSizeBytes,
    rawPages,
    isOcr,
  } = params;

  // Filter and ensure sequential 1-indexed pages
  const cleanedPages: PageContent[] = rawPages.map((page, index) => {
    const cleanedText = cleanRawText(page.text);
    return {
      pageNumber: index + 1,
      text: cleanedText,
      charCount: cleanedText.length,
      wordCount: countWords(cleanedText),
    };
  });

  // Guarantee at least one page even if raw input was empty
  if (cleanedPages.length === 0) {
    cleanedPages.push({
      pageNumber: 1,
      text: "",
      charCount: 0,
      wordCount: 0,
    });
  }

  // Construct combined full text with formal page anchors
  const fullText = cleanedPages
    .map((p) => `--- [Page ${p.pageNumber}] ---\n${p.text}`)
    .join("\n\n")
    .trim();

  const doc: ParsedDocument = {
    id,
    filename: filename.trim() || "document",
    mimeType,
    fileSizeBytes,
    pageCount: cleanedPages.length,
    pages: cleanedPages,
    fullText,
    isOcr,
    createdAt: new Date().toISOString(),
  };

  // Validate against Zod schema to guarantee runtime correctness
  return ParsedDocumentSchema.parse(doc);
}
