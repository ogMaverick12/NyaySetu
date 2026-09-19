import { type ParsedDocument } from "@/features/ingestion/types";

export type DocumentType = "tenancy" | "gig-partner" | "employment";

/**
 * Detects whether a document is a tenancy agreement, gig-partner agreement, or employment contract.
 */
export function detectDocumentType(doc: ParsedDocument): DocumentType {
  const text = (doc.filename + " " + doc.fullText).toLowerCase();
  const gigKeywords =
    /\b(gig|delivery|partner|driver|fleet|platform|rider|contractor|zomato|swiggy|uber|ola|fairwork|payout|payouts|incentive|incentives|deactivation)\b/g;
  const empKeywords =
    /\b(employment|employee|employer|offer letter|probation|job title|salary|ctc|appraisal|workplace|gratuity|provident fund|annual compensation)\b/g;
  const tenancyKeywords =
    /\b(tenancy|tenant|landlord|rent|rental|lease|lessor|lessee|premises|security deposit|licensor|licensee|flat|apartment|house|eviction)\b/g;

  const gigCount = (text.match(gigKeywords) || []).length;
  const empCount = (text.match(empKeywords) || []).length;
  const tenancyCount = (text.match(tenancyKeywords) || []).length;

  if (tenancyCount >= gigCount && tenancyCount >= empCount) {
    return "tenancy";
  }
  if (gigCount > empCount) {
    return "gig-partner";
  }
  if (empCount > 0) {
    return "employment";
  }
  return "tenancy";
}

export const CLAUSE_EXTRACTION_SYSTEM_INSTRUCTION = `You are NyaySetu's senior legal analyst AI. Your mission is to assist citizens (tenants, gig workers, small traders, employees) in understanding contracts and identifying legal risks.

You must analyze the entire document and extract all substantive operative clauses into a structured JSON array under the key "clauses".

CRITICAL VOCABULARY & DOMAIN ACCURACY:
Always use terminology appropriate to the document type:
- For tenancy agreements: Use "tenant", "landlord", "rent", "security deposit", "premises", "lease". DO NOT use contractor, gig, or employment terms (never use "individual contractor", "fees received", "platform", or "salary" for a tenancy agreement).
- For gig-partner agreements: Use "partner", "contractor", "platform", "fees received", "payout".
- For employment contracts: Use "employee", "employer", "salary", "workplace".

For each clause:
1. "id": A unique identifier, e.g. "cl_1", "cl_2".
2. "page": The integer page number (1-based) where the clause appears in the document.
3. "sourceText": Verbatim excerpt from the document (keep it faithful to the original text).
4. "type": Standardized category (e.g., "security_deposit", "notice_period", "termination", "indemnity_liability", "account_deactivation", "dispute_resolution", "penalties", "working_hours").
5. "plainSummary": A clear, plain-language translation written for a normal citizen with no law degree, using type-appropriate vocabulary.
6. "riskLevel": Must be exactly one of:
   - "info": Standard, balanced, customary clause with no unusual burden.
   - "caution": Asymmetric terms, short notice, automatic renewals, or conditions requiring review.
   - "high-risk": Extreme one-sided indemnification, unilateral termination without cause or notice, forfeiture of rights/deposits, or uncapped liabilities.
7. "rationale": Clear justification for the assigned risk level, pointing out what disadvantage or protection exists.

Output ONLY valid JSON matching:
{
  "clauses": [
    {
      "id": "cl_1",
      "page": 1,
      "sourceText": "...",
      "type": "...",
      "plainSummary": "...",
      "riskLevel": "info",
      "rationale": "..."
    }
  ]
}`;

export function buildExtractionUserPrompt(
  doc: ParsedDocument,
  documentType?: DocumentType
): string {
  const docType = documentType || detectDocumentType(doc);

  let typeGuidance = "";
  if (docType === "tenancy") {
    typeGuidance = `DOCUMENT TYPE: Tenancy Agreement (Residential / Commercial Lease).
TERMINOLOGY REQUIREMENT: Use tenancy-specific terms ("tenant", "landlord", "rent", "security deposit", "premises", "lease").
NEVER use gig-worker, contractor, or employment terms (do NOT use "individual contractor", "platform", "fees received", or "salary").`;
  } else if (docType === "gig-partner") {
    typeGuidance = `DOCUMENT TYPE: Gig-Partner / Platform Agreement.
TERMINOLOGY REQUIREMENT: Use gig-economy terms ("delivery partner", "contractor", "platform", "fees received", "payout").`;
  } else {
    typeGuidance = `DOCUMENT TYPE: Employment Contract.
TERMINOLOGY REQUIREMENT: Use employment-specific terms ("employee", "employer", "salary", "service terms", "workplace").`;
  }

  return `Analyze the following legal document and extract all clauses with risk scoring per your system instructions.

Document Filename: ${doc.filename}
Total Pages: ${doc.pageCount}
${typeGuidance}

DOCUMENT CONTENT:
${doc.fullText}

Extract every substantive clause into the JSON format with "clauses" array. Return only the JSON object.`;
}
