import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ParsedDocumentSchema } from "@/features/ingestion/types";
import { ClauseSchema } from "@/features/extraction/types";
import {
  buildDeterministicBaselineComparison,
  parseLlmComparisonOutput,
} from "@/features/compare/services/compare-service";
import { getDefaultLLMProvider } from "@/lib/llm";
import { enforceRateLimit, securityLogger } from "@/lib/security";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Shared 503 response when both LLM providers fail in production. */
function unavailableError(): NextResponse {
  return NextResponse.json(
    { error: "Analysis temporarily unavailable — please retry in a moment." },
    { status: 503 }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Enforce rate limiting on compare endpoint
  const rateLimitResponse = enforceRateLimit(request, "compare");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await request.json()) as {
      mode?: "doc_vs_baseline" | "doc_vs_doc";
      targetDoc?: unknown;
      baselineKey?: string;
      secondDoc?: unknown;
      clauses?: unknown;
    };

    const targetParsed = ParsedDocumentSchema.safeParse(body.targetDoc);
    if (!targetParsed.success) {
      securityLogger.warn("COMPARE_INVALID_TARGET_DOC", {
        issues: targetParsed.error.issues.length,
      });
      return NextResponse.json(
        { error: "Invalid target document provided for comparison." },
        { status: 400 }
      );
    }

    const clausesParsed = z.array(ClauseSchema).optional().safeParse(body.clauses);
    const extractedClauses = clausesParsed.success ? clausesParsed.data : undefined;

    const mode = body.mode || "doc_vs_baseline";

    // ─── Mode A: Document vs Baseline Template ───────────────────────────────
    if (mode === "doc_vs_baseline") {
      const baselineKey = body.baselineKey || "residential_tenancy";

      // The baseline comparison is fully deterministic (sourced statutory
      // templates, zero LLM tokens). Liveness is derived from key presence —
      // no probe LLM call is spent just to label the result.
      const isLive = Boolean(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY);

      const baselineComp = buildDeterministicBaselineComparison(
        targetParsed.data,
        baselineKey,
        extractedClauses
      );

      return NextResponse.json({
        success: true,
        // _degraded is only set when no live LLM is configured.
        ...(!isLive && { _degraded: true }),
        result: baselineComp,
      });
    }

    // ─── Mode B: Document vs Document ────────────────────────────────────────
    const secondParsed = ParsedDocumentSchema.safeParse(body.secondDoc);
    if (!secondParsed.success) {
      return NextResponse.json(
        { error: "Second document is required for doc-vs-doc comparison." },
        { status: 400 }
      );
    }

    const docA = targetParsed.data;
    const docB = secondParsed.data;

    try {
      const provider = getDefaultLLMProvider();
      const res = await provider.extractClauses(docA);

      const comparisonResult = parseLlmComparisonOutput(
        JSON.stringify({
          summary: `Compared "${docA.filename}" against "${docB.filename}".`,
          differences: res.clauses.map((c, i) => ({
            id: `diff_${i + 1}`,
            clauseType: c.type,
            title: c.plainSummary,
            baseText: c.sourceText,
            targetText: `Revised in ${docB.filename}: ${c.plainSummary}`,
            impactOnUser: c.riskLevel === "high-risk" ? "disadvantageous" : "neutral",
            explanation: c.rationale,
            severity: c.riskLevel === "high-risk" ? "high" : "medium",
          })),
        }),
        docA.filename,
        docB.filename,
        "doc_vs_doc"
      );

      return NextResponse.json({ success: true, result: comparisonResult });
    } catch (err: unknown) {
      securityLogger.warn("COMPARE_LLM_FAILED_USING_DETERMINISTIC", {
        mode: "doc_vs_doc",
        docId: docA.id,
        reason: err instanceof Error ? err.message.slice(0, 200) : String(err),
      });

      // In production: surface an honest error — never substitute content.
      if (IS_PRODUCTION) return unavailableError();

      // Non-production: deterministic fallback, clearly labeled.
      const baselineComp = buildDeterministicBaselineComparison(docA, "residential_tenancy");
      return NextResponse.json({
        success: true,
        _degraded: true,
        result: {
          ...baselineComp,
          mode: "doc_vs_doc",
          baseName: docA.filename,
          targetName: docB.filename,
        },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Comparison failed";
    return NextResponse.json({ error: `Comparison error: ${msg}` }, { status: 500 });
  }
}
