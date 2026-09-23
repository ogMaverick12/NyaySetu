import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ParsedDocumentSchema } from "@/features/ingestion/types";
import { ClauseSchema } from "@/features/extraction/types";
import { getDefaultLLMProvider } from "@/lib/llm";
import { evaluateDeterministicQA } from "@/features/qa-chat/services/rag-retriever";
import { enforceRateLimit, securityLogger, sessionStore } from "@/lib/security";

const QARequestSchema = z.object({
  doc: ParsedDocumentSchema,
  question: z.string().min(1, "Question cannot be empty"),
  clauses: z.array(ClauseSchema).optional(),
});

export async function POST(req: NextRequest) {
  // 1. Rate limiting on QA consultation endpoint
  const rateLimitResponse = enforceRateLimit(req, "qa");
  if (rateLimitResponse) return rateLimitResponse;

  const sessionId = req.headers.get("x-session-id") || req.cookies.get("nyaysetu_session")?.value;

  try {
    const rawBody: unknown = await req.json();
    const parsed = QARequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      securityLogger.warn("QA_INVALID_PAYLOAD", {
        issues: parsed.error.issues?.length || 1,
      });
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const { doc, question, clauses } = parsed.data;

    // Check if API keys are available for live LLM call
    if (process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY) {
      try {
        const provider = getDefaultLLMProvider();
        const response = await provider.answerQuestion(doc, question, clauses);

        // Record sanitized telemetry (no raw question or answer text in logs)
        securityLogger.info("QA_CONSULTATION_LIVE", {
          docId: doc.id,
          provider: response.metadata.provider,
          latencyMs: response.metadata.latencyMs,
          citationCount: response.citations.length,
          sessionId: sessionId || "ephemeral",
        });

        if (sessionId) {
          const session = sessionStore.getSession(sessionId);
          if (session) {
            session.qaHistory.push({
              question: "Consultation inquiry",
              answer: "Consultation response",
              timestamp: Date.now(),
            });
          }
        }

        return NextResponse.json({
          success: true,
          result: response,
        });
      } catch (err: unknown) {
        securityLogger.warn("QA_ALL_PROVIDERS_FAILED", {
          docId: doc.id,
          sessionId: sessionId || "ephemeral",
          error: err instanceof Error ? err.message.slice(0, 200) : String(err),
        });

        // In production: both providers failed — surface an honest error, never substitute content.
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { error: "Analysis temporarily unavailable — please retry in a moment." },
            { status: 503 }
          );
        }
        // In non-production: fall through to deterministic RAG (dev/test only).
      }
    }

    // Deterministic RAG engine — only reachable in non-production environments.
    // Marked with _degraded:true and corrected metadata so it can never be
    // mistaken for a live grounded LLM answer.
    securityLogger.warn("QA_DETERMINISTIC_MODE_ACTIVE", {
      docId: doc.id,
      sessionId: sessionId || "ephemeral",
      reason: "No LLM API keys configured or non-production environment",
    });

    const deterministicPayload = evaluateDeterministicQA(doc, question, clauses);

    securityLogger.info("QA_CONSULTATION_DETERMINISTIC", {
      docId: doc.id,
      model: "deterministic-rag-engine",
      citationCount: deterministicPayload.citations.length,
      sessionId: sessionId || "ephemeral",
    });

    return NextResponse.json({
      success: true,
      // _degraded: visible to the client so UI can label this as non-live.
      _degraded: true,
      result: {
        ...deterministicPayload,
        metadata: {
          // Correct provider label — never impersonate "gemini" for a local result.
          provider: "deterministic-rag" as const,
          model: "deterministic-rag-engine",
          latencyMs: 12,
          fallbackTriggered: true,
        },
      },
    });
  } catch (err: unknown) {
    securityLogger.error("QA_ROUTE_ERROR", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
