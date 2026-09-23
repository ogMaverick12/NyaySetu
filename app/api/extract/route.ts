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

    const doc = parsedDocResult.data;

    // Session reuse: the same document already extracted in this session costs
    // zero new LLM tokens — return the cached clauses instead of re-billing.
    if (sessionId) {
      const session = sessionStore.getSession(sessionId);
      if (session?.document?.id === doc.id && session.clauses.length > 0) {
        securityLogger.info("CLAUSE_EXTRACTION_CACHE_HIT", {
          docId: doc.id,
          clauseCount: session.clauses.length,
          sessionId,
        });
        return NextResponse.json({
          success: true,
          cached: true,
          clauses: session.clauses,
          metadata: session.metadata,
        });
      }
    }

    // Fail honest and cheap: without any LLM key configured, extraction cannot
    // run — return 503 (not a 500 pipeline error) so clients can message it.
    if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
      securityLogger.warn("EXTRACTION_NO_LLM_KEYS", { docId: doc.id });
      return NextResponse.json(
        {
          error:
            "Language services are not configured — clause extraction needs at least one LLM API key. Document intake, checklist, and Fairness Score remain available.",
        },
        { status: 503 }
      );
    }

    const provider = getDefaultLLMProvider();
    const result = await provider.extractClauses(doc);

    // 2. Update session-scoped storage
    if (sessionId) {
      sessionStore.updateSession(sessionId, {
        document: doc,
        clauses: result.clauses,
        metadata: result.metadata,
      });
    }

    // 3. Sanitized Audit Log (Zero document text in logs)
    securityLogger.info("CLAUSE_EXTRACTION_SUCCESS", {
      docId: doc.id,
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
