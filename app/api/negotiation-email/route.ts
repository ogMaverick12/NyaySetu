import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ClauseSchema } from "@/features/extraction/types";
import { ComparisonDifferenceSchema } from "@/features/compare/types";
import { getDefaultLLMProvider } from "@/lib/llm";
import { enforceRateLimit, securityLogger } from "@/lib/security";

const NegotiationEmailRequestSchema = z.object({
  documentType: z.enum(["tenancy", "gig-partner", "employment"]),
  documentFilename: z.string().min(1, "Document filename cannot be empty"),
  clauses: z.array(ClauseSchema).min(1, "At least one clause is required"),
  comparisonDifferences: z.array(ComparisonDifferenceSchema).optional(),
  partiesSummary: z.string().optional(),
  stream: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  // 1. Enforce sliding-window rate limit (15 requests per 15 mins)
  const rateLimitResponse = enforceRateLimit(req, "negotiation-email");
  if (rateLimitResponse) return rateLimitResponse;

  const sessionId = req.headers.get("x-session-id") || req.cookies.get("nyaysetu_session")?.value;

  try {
    const rawBody: unknown = await req.json();
    const parsed = NegotiationEmailRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      securityLogger.warn("NEGOTIATION_EMAIL_INVALID_PAYLOAD", {
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

    const {
      documentType,
      documentFilename,
      clauses,
      comparisonDifferences,
      partiesSummary,
      stream,
    } = parsed.data;

    // Check if live LLM keys exist
    if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        {
          error:
            "LLM services are not configured. Please set GEMINI_API_KEY or OPENROUTER_API_KEY.",
        },
        { status: 503 }
      );
    }

    const provider = getDefaultLLMProvider();
    const response = await provider.generateNegotiationEmail({
      documentType,
      documentFilename,
      clauses,
      comparisonDifferences,
      partiesSummary,
    });

    // Sanitized security audit logging — strictly NO raw text or email bodies in logs
    securityLogger.info("NEGOTIATION_EMAIL_GENERATED", {
      docFilename: documentFilename,
      docType: documentType,
      provider: response.metadata.provider,
      latencyMs: response.metadata.latencyMs,
      citedCount: response.draft.citedClauseIds.length,
      sessionId: sessionId || "ephemeral",
    });

    // If client requested streaming, stream the generated email body progressively
    if (stream) {
      const encoder = new TextEncoder();
      const bodyText = response.draft.body;
      const chunkSize = 25; // Characters per chunk for smooth typewriter effect

      const readableStream = new ReadableStream({
        async start(controller) {
          // Send initial metadata event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "start",
                subject: response.draft.subject,
                citedClauseIds: response.draft.citedClauseIds,
              })}\n\n`
            )
          );

          // Stream body in simulated/buffered progressive chunks
          for (let i = 0; i < bodyText.length; i += chunkSize) {
            const chunk = bodyText.slice(i, i + chunkSize);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "delta",
                  chunk,
                })}\n\n`
              )
            );
            // Brief micro-delay for realistic streaming
            await new Promise((r) => setTimeout(r, 15));
          }

          // Send final completion event with verified payload
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "complete",
                draft: response.draft,
                metadata: response.metadata,
              })}\n\n`
            )
          );

          controller.close();
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // Default JSON response
    return NextResponse.json({
      success: true,
      draft: response.draft,
      metadata: response.metadata,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal server error";

    // Sanitized error logging
    securityLogger.warn("NEGOTIATION_EMAIL_ERROR", {
      error: errorMsg.slice(0, 200),
      sessionId: sessionId || "ephemeral",
    });

    return NextResponse.json(
      {
        error: errorMsg || "Failed to generate negotiation email draft.",
      },
      { status: 500 }
    );
  }
}
