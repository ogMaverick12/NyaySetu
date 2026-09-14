import { NextRequest, NextResponse } from "next/server";
import { ParsedDocumentSchema } from "@/features/ingestion/types";
import { getDefaultLLMProvider } from "@/lib/llm";
import { enforceRateLimit, securityLogger, sessionStore } from "@/lib/security";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Rate limiting on extraction endpoint
  const rateLimitResponse = enforceRateLimit(request, "extract");
  if (rateLimitResponse) return rateLimitResponse;

  const sessionId =
    request.headers.get("x-session-id") || request.cookies.get("nyaysetu_session")?.value;

  try {
    const body = (await request.json()) as { document?: unknown };

    if (!body.document) {
      return NextResponse.json(
        { error: "Missing document payload in request body." },
        { status: 400 }
      );
    }

    const parsedDocResult = ParsedDocumentSchema.safeParse(body.document);
    if (!parsedDocResult.success) {
      securityLogger.warn("EXTRACTION_INVALID_PAYLOAD", {
        issues: parsedDocResult.error.issues.length,
      });
      return NextResponse.json(
        {
          error: "Invalid document structure provided.",
          details: parsedDocResult.error.issues,
        },
        { status: 400 }
      );
    }

    const provider = getDefaultLLMProvider();
    const result = await provider.extractClauses(parsedDocResult.data);

    // 2. Update session-scoped storage
    if (sessionId) {
      sessionStore.updateSession(sessionId, {
        document: parsedDocResult.data,
        clauses: result.clauses,
        metadata: result.metadata,
      });
    }

    // 3. Sanitized Audit Log (Zero document text in logs)
    securityLogger.info("CLAUSE_EXTRACTION_SUCCESS", {
      docId: parsedDocResult.data.id,
      clauseCount: result.clauses.length,
      providerServed: result.metadata.provider,
      fallbackTriggered: result.metadata.fallbackTriggered,
      latencyMs: result.metadata.latencyMs,
      sessionId: sessionId || "ephemeral",
    });

    return NextResponse.json({
      success: true,
      clauses: result.clauses,
      metadata: result.metadata,
    });
  } catch (err: unknown) {
    securityLogger.error("EXTRACTION_PIPELINE_ERROR", err);
    const message = err instanceof Error ? err.message : "Clause extraction failed";
    return NextResponse.json({ error: `Extraction pipeline error: ${message}` }, { status: 500 });
  }
}
