import { type NegotiationEmailPromptInput } from "../types";
import { type Clause } from "@/features/extraction/types";
import { type ComparisonDifference } from "@/features/compare/types";

export const NEGOTIATION_EMAIL_SYSTEM_INSTRUCTION = `You are NyaySetu's legal negotiation assistant.
Your mission is to help a citizen (tenant, gig worker, or employee) draft a professional, polite, and constructive negotiation email requesting fair amendment of risky or asymmetric contract clauses.

CORE TONE GUIDELINES:
1. Tone must be collaborative, professional, and respectful — NEVER accusatory, hostile, or litigious.
2. Frame requested changes around mutual clarity, long-term goodwill, and fair statutory practice.
3. Express enthusiasm or intent to sign once these specific items are clarified or harmonized.

CRITICAL VOCABULARY & DOMAIN ACCURACY:
- For tenancy agreements: Use "tenant", "landlord", "rent", "security deposit", "premises", "lease". DO NOT use gig or employment terms (never use "individual contractor", "fees received", "platform", or "salary" for a tenancy agreement).
- For gig-partner agreements: Use "partner", "contractor", "platform", "fees received", "payout".
- For employment contracts: Use "employee", "employer", "salary", "compensation", "workplace".

PARTIES & PREMISES RULES:
- Use only the party names, roles, and premises details explicitly provided in the prompt context.
- If specific party names or premises addresses were not captured, use standard polite placeholders in brackets (e.g., "[Landlord Name]", "[Property Address]") so the user can easily fill or verify them.
- NEVER invent or hallucinate fictitious names, addresses, or dates.

SPECIFICITY & AMENDMENT CITATIONS:
- Directly address each high-risk and caution clause provided in the context.
- For each item, clearly state:
  a) The specific clause or topic.
  b) Why the current wording presents practical difficulty or asymmetry.
  c) A reasonable, standard proposed compromise (e.g., equal reciprocal notice period, capping deposit refund window to statutory standard, mutual indemnification).
- If statutory baseline differences are included, cite them gently as fair-practice benchmarks.
- Return the list of cited clause IDs in "citedClauseIds".

OUTPUT FORMAT:
Output strictly valid JSON with NO markdown code fences or conversational preamble, matching:
{
  "subject": "Discussion on [Agreement Title/Premises] - Clarification on Terms",
  "body": "Dear [Recipient Name],\\n\\nThank you for sharing the draft agreement for...\\n\\n[Specific clause requests]\\n\\nSincerely,\\n[User Name]",
  "citedClauseIds": ["clause_id_1", "clause_id_2"]
}`;

/**
 * Extracts party names and premises details captured in clause source texts or summaries.
 */
export function extractPartiesAndPremisesSummary(clauses: Clause[]): string {
  const partyKeywords =
    /(landlord|lessor|tenant|lessee|licensor|licensee|employer|employee|company|contractor|partner)\b/i;
  const premisesKeywords =
    /(premises|property|flat|apartment|house|situated at|bearing no|located at)\b/i;

  const relevantSnippets: string[] = [];

  for (const clause of clauses) {
    const text = clause.sourceText;
    if (
      partyKeywords.test(text) ||
      premisesKeywords.test(text) ||
      clause.type.toLowerCase().includes("party")
    ) {
      // Keep only concise excerpts to preserve token efficiency
      relevantSnippets.push(`[${clause.type}]: ${clause.plainSummary}`);
    }
  }

  if (relevantSnippets.length === 0) {
    return "No explicit party names or premises details captured in extracted clauses.";
  }

  return relevantSnippets.slice(0, 4).join("\n");
}

/**
 * Builds the user prompt containing only the pre-extracted high-risk/caution clauses
 * and Compare baseline differences.
 *
 * Strict Efficiency Rule (02-TRD.md):
 * Exactly one LLM call. Does NOT include the raw document text, keeping token usage minimal.
 */
export function buildNegotiationEmailUserPrompt(input: NegotiationEmailPromptInput): string {
  const { documentType, documentFilename, clauses, comparisonDifferences, partiesSummary } = input;

  // Filter only high-risk and caution clauses
  const targetClauses = clauses.filter(
    (c) => c.riskLevel === "high-risk" || c.riskLevel === "caution"
  );

  // Filter only disadvantageous comparison differences
  const targetDifferences = (comparisonDifferences || []).filter(
    (d: ComparisonDifference) => d.impactOnUser === "disadvantageous"
  );

  const contextParties = partiesSummary || extractPartiesAndPremisesSummary(clauses);

  const clauseSections = targetClauses
    .map((c, i) => {
      return `Clause Item ${i + 1} (ID: "${c.id}"):
- Clause Category: ${c.type}
- Assigned Risk: ${c.riskLevel.toUpperCase()}
- Citizen Summary: ${c.plainSummary}
- Contract Wording Excerpt: "${c.sourceText.slice(0, 300)}"
- Identified Asymmetry/Rationale: ${c.rationale}`;
    })
    .join("\n\n");

  const differenceSections = targetDifferences
    .map((d, i) => {
      return `Baseline Disparity ${i + 1} (ID: "${d.id}"):
- Issue: ${d.title}
- Current Contract Provision: "${d.targetText.slice(0, 200)}"
- Recommended Statutory Baseline: "${d.baseText.slice(0, 200)}"
- Explanation: ${d.explanation}`;
    })
    .join("\n\n");

  return `DOCUMENT PROFILE:
- Document Filename: ${documentFilename}
- Agreement Classification: ${documentType.toUpperCase()}
- Extracted Parties/Premises Context:
${contextParties}

IDENTIFIED HIGH-RISK & CAUTION CLAUSES REQUIRING AMENDMENT (${targetClauses.length} items):
${clauseSections || "No high-risk or caution clauses identified; draft a general confirmation inquiry."}

${
  targetDifferences.length > 0
    ? `STATUTORY BENCHMARK DISPARITIES (${targetDifferences.length} items):\n${differenceSections}\n`
    : ""
}
INSTRUCTION:
Generate a single, well-structured, editable draft negotiation email requesting polite, practical amendments to the clauses above. Follow all domain vocabulary, non-accusatory tone, and JSON schema rules.`;
}
