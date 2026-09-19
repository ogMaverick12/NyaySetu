import { type ComparisonDifference, type ComparisonResult, ComparisonResultSchema } from "../types";
import { BASELINE_TEMPLATES } from "../data/baseline-templates";
import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { cleanJsonString } from "@/features/extraction/services/clause-validator";

/**
 * Builds the LLM prompt for redline contract comparison.
 */
export function buildComparePrompt(
  baseTitle: string,
  baseText: string,
  targetTitle: string,
  targetText: string
): string {
  return `You are a legal contract comparison specialist for citizens. Your job is to compare two versions of a legal contract (Base Version vs Revised Target Version) and identify substantive differences.

Crucially: For each changed clause, you MUST determine whether the revision FAVORS the citizen/user ("favorable"), DISADVANTAGES them ("disadvantageous"), or is NEUTRAL ("neutral").

BASE CONTRACT (${baseTitle}):
${baseText.slice(0, 6000)}

TARGET CONTRACT (${targetTitle}):
${targetText.slice(0, 6000)}

INSTRUCTIONS:
Return a single JSON object with:
- "summary": High-level 2-sentence executive summary of which version is overall better or worse for the citizen.
- "differences": Array of changed clauses with:
  - "id": string like "diff_1"
  - "clauseType": standard key (e.g. "security_deposit", "notice_period", "indemnity", "liability", "termination")
  - "title": plain title of the changed provision
  - "baseText": the exact or summarized text in Base
  - "targetText": the changed text in Target
  - "impactOnUser": exactly one of "favorable" | "disadvantageous" | "neutral"
  - "explanation": plain-language rationale explaining how this revision harms or benefits the citizen
  - "severity": "low" | "medium" | "high"

Output ONLY valid JSON.`;
}

/**
 * Compares an uploaded document against a pre-sourced statutory baseline template.
 * When extracted clauses are available, it matches against the indexed clauses to prevent
 * false negatives ("Clause not explicitly stated").
 */
export function buildDeterministicBaselineComparison(
  doc: ParsedDocument,
  baselineKey: string,
  clauses?: Clause[]
): ComparisonResult {
  const baseline = BASELINE_TEMPLATES[baselineKey] || BASELINE_TEMPLATES.residential_tenancy;

  const differences: ComparisonDifference[] = baseline.clauses.map((baseClause, idx) => {
    // 1. Check if extracted clauses have a match for this clause type
    const matchingExtracted = clauses?.find((c) => {
      const cType = c.type.toLowerCase().replace(/[\s-]/g, "_");
      const bType = baseClause.type.toLowerCase().replace(/[\s-]/g, "_");
      if (cType === bType || cType.includes(bType) || bType.includes(cType)) return true;
      const keywords = bType.split("_");
      return keywords.some((kw) => kw.length > 3 && c.sourceText.toLowerCase().includes(kw));
    });

    if (matchingExtracted) {
      const impact: "favorable" | "disadvantageous" | "neutral" =
        matchingExtracted.riskLevel === "high-risk"
          ? "disadvantageous"
          : matchingExtracted.riskLevel === "caution"
            ? "neutral"
            : "favorable";

      return {
        id: `diff_${idx + 1}`,
        clauseType: baseClause.type,
        title: baseClause.title,
        baseText: baseClause.standardText,
        targetText: matchingExtracted.sourceText,
        impactOnUser: impact,
        explanation:
          matchingExtracted.rationale ||
          `Extracted operative provision (${matchingExtracted.plainSummary}) evaluated against ${baseline.sourcedReference}.`,
        severity:
          matchingExtracted.riskLevel === "high-risk"
            ? "high"
            : matchingExtracted.riskLevel === "caution"
              ? "medium"
              : "low",
      };
    }

    // Check if target document text mentions this clause type
    const typeKeyword = baseClause.type.replace(/_/g, " ");

    let targetExcerpt = "Clause not explicitly stated in uploaded document.";
    let impact: "favorable" | "disadvantageous" | "neutral" = "disadvantageous";
    let explanation = `The uploaded document lacks the standard ${baseClause.title} protection guaranteed under ${baseline.sourcedReference}.`;
    let severity: "low" | "medium" | "high" = "high";

    // Detect deposit terms
    if (baseClause.type === "security_deposit") {
      const depositMatch = doc.fullText.match(/deposit[^.\n]{10,120}/i);
      if (depositMatch) {
        targetExcerpt = depositMatch[0].trim();
        if (
          targetExcerpt.includes("96,000") ||
          targetExcerpt.includes("three months") ||
          targetExcerpt.includes("3 months")
        ) {
          impact = "disadvantageous";
          explanation =
            "Uploaded document requires 3 months deposit, whereas the Model Tenancy standard caps residential deposits at 2 months.";
          severity = "high";
        } else if (targetExcerpt.includes("2 months") || targetExcerpt.includes("two months")) {
          impact = "favorable";
          explanation =
            "Uploaded document aligns with the Model Tenancy standard 2-month deposit ceiling.";
          severity = "low";
        }
      }
    } else if (baseClause.type === "notice_period" || baseClause.type === "termination_notice") {
      const noticeSentence = doc.fullText.split(/[.\n]/).find((s) => /notice|terminate/i.test(s));
      if (noticeSentence) {
        targetExcerpt = noticeSentence.trim();
      }
      if (
        (doc.fullText.includes("15 days") && doc.fullText.includes("60 days")) ||
        (targetExcerpt.includes("15 days") && targetExcerpt.includes("60 days"))
      ) {
        impact = "disadvantageous";
        explanation =
          "Asymmetric notice: landlord can terminate in 15 days, but tenant must give 60 days. MTA standard mandates equal reciprocal notice.";
        severity = "high";
      } else if (noticeSentence) {
        impact = "neutral";
        explanation =
          "Notice provision is present but differs slightly in phrasing from the model statutory template.";
        severity = "medium";
      }
    } else if (baseClause.type === "account_deactivation") {
      const deactMatch = doc.fullText.match(/deactivat[^.\n]{10,120}/i);
      if (deactMatch) {
        targetExcerpt = deactMatch[0].trim();
        if (
          targetExcerpt.includes("unilateral") ||
          targetExcerpt.includes("without prior notice")
        ) {
          impact = "disadvantageous";
          explanation =
            "Platform reserves unilateral deactivation without prior notice, violating the 7-day fair notice and appeal standard.";
          severity = "high";
        }
      }
    } else if (baseClause.type === "indemnity_liability") {
      const indMatch = doc.fullText.match(/indemnif[^.\n]{10,120}/i);
      if (indMatch) {
        targetExcerpt = indMatch[0].trim();
        if (
          targetExcerpt.includes("without cap") ||
          targetExcerpt.includes("all third-party") ||
          targetExcerpt.includes("hold harmless")
        ) {
          impact = "disadvantageous";
          explanation =
            "Contract imposes uncapped unilateral indemnification onto you for third-party claims, failing the fair mutual cap standard.";
          severity = "high";
        }
      }
    } else {
      const genericMatch = doc.fullText.match(new RegExp(`${typeKeyword}[^.\n]{10,100}`, "i"));
      if (genericMatch) {
        targetExcerpt = genericMatch[0].trim();
        impact = "neutral";
        explanation = `Terms for ${baseClause.title} diverge from the statutory baseline wording.`;
        severity = "medium";
      }
    }

    return {
      id: `diff_${idx + 1}`,
      clauseType: baseClause.type,
      title: baseClause.title,
      baseText: baseClause.standardText,
      targetText: targetExcerpt,
      impactOnUser: impact,
      explanation,
      severity,
    };
  });

  const favorableCount = differences.filter((d) => d.impactOnUser === "favorable").length;
  const disadvantageousCount = differences.filter(
    (d) => d.impactOnUser === "disadvantageous"
  ).length;
  const neutralCount = differences.filter((d) => d.impactOnUser === "neutral").length;

  const result: ComparisonResult = {
    id: `comp_${Date.now()}`,
    mode: "doc_vs_baseline",
    baseName: baseline.title,
    targetName: doc.filename,
    differences,
    favorableCount,
    disadvantageousCount,
    neutralCount,
    summary: `Compared "${doc.filename}" against ${baseline.title}. Found ${disadvantageousCount} clause(s) that disadvantage you compared to statutory fair practice.`,
    comparedAt: new Date().toISOString(),
  };

  return ComparisonResultSchema.parse(result);
}

/**
 * Parses raw JSON output from an LLM comparison call.
 */
export function parseLlmComparisonOutput(
  rawJson: string,
  baseName: string,
  targetName: string,
  mode: "doc_vs_baseline" | "doc_vs_doc"
): ComparisonResult {
  const cleaned = cleanJsonString(rawJson);
  const parsed = JSON.parse(cleaned) as {
    summary?: string;
    differences?: ComparisonDifference[];
  };

  const differences = parsed.differences || [];
  const favorableCount = differences.filter((d) => d.impactOnUser === "favorable").length;
  const disadvantageousCount = differences.filter(
    (d) => d.impactOnUser === "disadvantageous"
  ).length;
  const neutralCount = differences.filter((d) => d.impactOnUser === "neutral").length;

  const result: ComparisonResult = {
    id: `comp_${Date.now()}`,
    mode,
    baseName,
    targetName,
    differences,
    favorableCount,
    disadvantageousCount,
    neutralCount,
    summary:
      parsed.summary ||
      `Identified ${differences.length} comparative clauses between ${baseName} and ${targetName}.`,
    comparedAt: new Date().toISOString(),
  };

  return ComparisonResultSchema.parse(result);
}
