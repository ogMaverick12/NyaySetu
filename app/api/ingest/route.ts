import { NextRequest, NextResponse } from "next/server";
import { extractDocumentContent } from "@/features/ingestion/services/extractor";
import { normalizeDocument } from "@/features/ingestion/services/normalizer";
import {
  enforceRateLimit,
  validateUploadedDocument,
  securityLogger,
  sessionStore,
} from "@/lib/security";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Enforce rate limiting on file ingestion
  const rateLimitResponse = enforceRateLimit(request, "ingest");
  if (rateLimitResponse) return rateLimitResponse;

  const sessionId =
    request.headers.get("x-session-id") || request.cookies.get("nyaysetu_session")?.value;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No document file provided in request." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Strict Magic-Byte & File Integrity Validation
    const validation = validateUploadedDocument(buffer, file.name, file.type);
    if (!validation.isValid || !validation.resolvedMime) {
      securityLogger.warn("INGEST_REJECTED_INVALID_FILE", {
        filename: file.name,
        size: file.size,
        reason: validation.error,
      });
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 3. Perform native PDF extraction or OCR
    const { rawPages, isOcr } = await extractDocumentContent(buffer, validation.resolvedMime);

    // 4. Normalize and validate into page-anchored structured schema
    const parsedDocument = normalizeDocument({
      filename: validation.sanitizedFilename || file.name,
      mimeType: validation.resolvedMime,
      fileSizeBytes: file.size,
      rawPages,
      isOcr,
    });

    // 5. Update session-scoped storage
    if (sessionId) {
      sessionStore.updateSession(sessionId, { document: parsedDocument });
    }

    // 6. Sanitized Audit Log (Strictly NO document content)
    securityLogger.info("DOCUMENT_INGESTED", {
      docId: parsedDocument.id,
      pageCount: parsedDocument.pageCount,
      fileSizeBytes: parsedDocument.fileSizeBytes,
      mimeType: parsedDocument.mimeType,
      isOcr: parsedDocument.isOcr,
      sessionId: sessionId || "ephemeral",
    });

    return NextResponse.json({
      success: true,
      document: parsedDocument,
    });
  } catch (err: unknown) {
    securityLogger.error("INGEST_PIPELINE_ERROR", err);
    const message = err instanceof Error ? err.message : "Failed to parse document";
    return NextResponse.json({ error: `Document ingestion failed: ${message}` }, { status: 500 });
  }
}
