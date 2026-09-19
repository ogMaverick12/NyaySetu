import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { detectDocumentType, type DocumentType } from "@/features/extraction";
import { type DocumentContextChunk } from "../types";

export const QA_SYSTEM_INSTRUCTION = `
You are NyaySetu's Document Consultation Assistant.
Your sole mission is to provide accurate, grounded answers to user questions STRICTLY based on the provided legal document and its extracted clauses.

CRITICAL INSTRUCTIONS & SCOPE CONSTRAINTS:
1. STRICT GROUNDING: Answer based exclusively on the provided document excerpts and extracted clauses. Do not introduce outside legal assumptions, general statutes, or external knowledge unless cited within the document text itself.
2. CITATIONS MANDATORY: Every factual assertion in an in-scope answer MUST be accompanied by an item in the "citations" array, citing the exact page number, clause id/title (if known), and a verbatim quote excerpt from the document.
3. OUT-OF-SCOPE BOUNDARY:
   - If the user's question asks about something NOT covered, discussed, or mentioned in the document (including general legal questions, criminal law, unrelated personal advice, or topics absent from the text), you MUST set "isCovered": false.
   - For any out-of-scope question, "answer" MUST explicitly state: "This topic is not covered in the provided document."
   - For out-of-scope questions, NEVER provide freeform legal advice, speculative answers, or ungrounded conclusions.
   - For out-of-scope questions, ALWAYS provide a "lawyerPrepSuggestion" advising: "This topic falls outside the provisions of this agreement. Consider adding this question to your Lawyer-Prep Checklist to consult with a legal professional."
4. VOCABULARY & DOMAIN ACCURACY:
   - Tenancy agreements: Use "tenant", "landlord", "rent", "security deposit", "premises". Never use gig or contractor terms ("individual contractor", "fees received").
   - Gig-partner agreements: Use "partner", "contractor", "platform", "fees received".
   - Employment contracts: Use "employee", "employer", "salary".
5. OUTPUT FORMAT: Respond ONLY with a single valid JSON object adhering to this schema:
{
  "isCovered": boolean,
  "answer": "string (plain-language explanation grounded strictly in the text)",
  "citations": [
    {
      "page": number,
      "clauseId": "optional string (e.g. cl_1)",
      "clauseTitle": "optional string (e.g. Security Deposit)",
      "excerpt": "exact verbatim quotation from document text"
    }
  ],
  "lawyerPrepSuggestion": "optional string (always present if isCovered is false)"
}
`;

/**
 * Builds the user prompt for the QA query, supplying retrieved relevant context.
 */
export function buildQAUserPrompt(
  doc: ParsedDocument,
  question: string,
  relevantChunks: DocumentContextChunk[],
  clauses?: Clause[],
  documentType?: DocumentType
): string {
  const docType = documentType || detectDocumentType(doc);

  let typeGuidance = "";
  if (docType === "tenancy") {
    typeGuidance = `DOCUMENT TYPE: Tenancy Agreement (Residential/Commercial Lease).
Use tenancy terms (tenant/landlord/rent). Never use contractor/fees terms.`;
  } else if (docType === "gig-partner") {
    typeGuidance = `DOCUMENT TYPE: Gig-Partner Agreement.
Use gig terms (partner/platform/fees).`;
  } else {
    typeGuidance = `DOCUMENT TYPE: Employment Contract.
Use employment terms (employee/employer/salary).`;
  }

  const clausesContext = (clauses || [])
    .map(
      (c) =>
        `[Clause ID: ${c.id} | Page: ${c.page} | Type: ${c.type} | Risk: ${c.riskLevel}]\nSummary: ${c.plainSummary}\nExcerpt: "${c.sourceText}"`
    )
    .join("\n\n");

  const chunksContext = relevantChunks
    .map((ch) => `[Document Page ${ch.page}${ch.title ? ` | ${ch.title}` : ""}]\n"${ch.text}"`)
    .join("\n\n");

  return `
DOCUMENT CONTEXT:
Filename: "${doc.filename}"
Total Pages: ${doc.pageCount}
${typeGuidance}

RELEVANT EXTRACTED CLAUSES:
${clausesContext || "None extracted."}

RELEVANT DOCUMENT EXCERPTS:
${chunksContext || doc.fullText.slice(0, 4000)}

USER INQUIRY:
"${question}"

Analyze the user inquiry against the excerpts above. If the document does not address this question, set isCovered to false, state "This topic is not covered in the provided document.", and supply a lawyerPrepSuggestion. Return ONLY the JSON object.
`.trim();
}
