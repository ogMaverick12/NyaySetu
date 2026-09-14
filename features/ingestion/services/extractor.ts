import { extractText } from "unpdf";
import { createWorker } from "tesseract.js";
import { type RawPageInput } from "./normalizer";

export interface ExtractionResult {
  rawPages: RawPageInput[];
  isOcr: boolean;
}

/**
 * Extracts text from native PDFs using unpdf.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  const uint8Array = new Uint8Array(buffer);
  const result = await extractText(uint8Array, { mergePages: false });

  const pageTexts = Array.isArray(result.text) ? result.text : [result.text];
  const rawPages: RawPageInput[] = pageTexts.map((text, idx) => ({
    pageNumber: idx + 1,
    text: text || "",
  }));

  // Check if PDF has actual selectable text
  const totalLength = rawPages.reduce((sum, p) => sum + p.text.trim().length, 0);

  // If PDF has no extractable text, it may be a scanned document wrapped in a PDF
  if (totalLength < 40) {
    // Return empty/minimal or mark OCR
    return {
      rawPages,
      isOcr: false,
    };
  }

  return {
    rawPages,
    isOcr: false,
  };
}

/**
 * Extracts text from an image (JPG/PNG) via local Tesseract OCR.
 */
export async function extractTextFromImage(buffer: Buffer): Promise<ExtractionResult> {
  const worker = await createWorker("eng");
  try {
    const ret = await worker.recognize(buffer);
    const ocrText = ret.data.text || "";

    return {
      rawPages: [
        {
          pageNumber: 1,
          text: ocrText,
        },
      ],
      isOcr: true,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * High-level extractor orchestrator. Selects native PDF parsing or OCR based on MIME type.
 */
export async function extractDocumentContent(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  const normalizedMime = mimeType.toLowerCase();

  if (normalizedMime === "application/pdf") {
    return extractTextFromPdf(buffer);
  }

  if (
    normalizedMime === "image/jpeg" ||
    normalizedMime === "image/png" ||
    normalizedMime === "image/jpg"
  ) {
    return extractTextFromImage(buffer);
  }

  throw new Error(`Unsupported document MIME type: ${mimeType}`);
}
