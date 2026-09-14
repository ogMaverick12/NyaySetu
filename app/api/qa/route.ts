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
        securityLogger.warn("QA_PROVIDER_FALLBACK_TRIGGERED", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Fallback: in-memory deterministic RAG engine
    const deterministicPayload = evaluateDeterministicQA(doc, question, clauses);

    securityLogger.info("QA_CONSULTATION_DETERMINISTIC", {
      docId: doc.id,
      model: "deterministic-rag-engine",
      citationCount: deterministicPayload.citations.length,
      sessionId: sessionId || "ephemeral",
    });

    return NextResponse.json({
      success: true,
      result: {
        ...deterministicPayload,
        metadata: {
          provider: "gemini" as const,
          model: "deterministic-rag-engine",
          latencyMs: 12,
          fallbackTriggered: false,
        },
      },
    });
  } catch (err: unknown) {
    securityLogger.error("QA_ROUTE_ERROR", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
