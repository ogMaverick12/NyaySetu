import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { ChecklistItemSchema, type ChecklistItem, type LegalMemo } from "../types";

/**
 * Generates an executive legal memorandum with zero user input required,
 * automatically deriving concrete action items and lawyer consultation questions
 * from high-risk and caution clauses.
 */
export function generateLegalMemo(
  doc: ParsedDocument,
  clauses: Clause[],
  bookmarkedQuestions: string[] = []
): LegalMemo {
  const highRiskClauses = clauses.filter((c) => c.riskLevel === "high-risk");
  const cautionClauses = clauses.filter((c) => c.riskLevel === "caution");

  const actionItems: ChecklistItem[] = [];
  const lawyerQuestions: ChecklistItem[] = [];
  const statutoryCitationsSet = new Set<string>();

  let itemCounter = 1;

  // 1. Process High-Risk Clauses
  highRiskClauses.forEach((clause) => {
    const typeLower = clause.type.toLowerCase();
    const textLower = clause.sourceText.toLowerCase();

    // Specific Action & Question for Notice Asymmetry
    if (
      typeLower.includes("notice") ||
      typeLower.includes("termination") ||
      /notice|terminat/i.test(textLower)
    ) {
      actionItems.push(
        ChecklistItemSchema.parse({
          id: `act_${itemCounter++}`,
          text: "Negotiate equal reciprocal notice: propose an identical 30-day termination notice requirement for both parties in writing.",
          kind: "action",
          sourceClauseId: clause.id,
        })
      );

      lawyerQuestions.push(
        ChecklistItemSchema.parse({
          id: `q_${itemCounter++}`,
          text: `Is the asymmetric notice provision (${clause.plainSummary}) legally enforceable under Section 106 of the Transfer of Property Act, 1882?`,
          kind: "lawyer_question",
          sourceClauseId: clause.id,
        })
      );
      statutoryCitationsSet.add("Transfer of Property Act, 1882 (Sec 106)");
      statutoryCitationsSet.add("Model Tenancy Act, 2021 (Reciprocal Termination)");
    }

    // Specific Action & Question for Deactivation / Suspension
    else if (typeLower.includes("deactivation") || /deactivat|suspen/i.test(textLower)) {
      actionItems.push(
        ChecklistItemSchema.parse({
          id: `act_${itemCounter++}`,
          text: "Maintain personal offline archives of all delivery logs, dispute records, and customer ratings to contest arbitrary account suspension.",
          kind: "action",
          sourceClauseId: clause.id,
        })
      );

      lawyerQuestions.push(
        ChecklistItemSchema.parse({
          id: `q_${itemCounter++}`,
          text: "Does the platform's unilateral deactivation clause violate natural justice or the fair contract principles outlined in the Fairwork India 2020 guidelines?",
          kind: "lawyer_question",
          sourceClauseId: clause.id,
        })
      );
      statutoryCitationsSet.add("Fairwork India Principles (Fair Contracts & Appeals)");
    }

    // Specific Action & Question for Non-Compete / Restraint
    else if (typeLower.includes("compete") || /compete|restraint/i.test(textLower)) {
      actionItems.push(
        ChecklistItemSchema.parse({
          id: `act_${itemCounter++}`,
          text: "Identify all prospective clients or geographic areas affected by the restrictive covenant before entering post-contract commitments.",
          kind: "action",
          sourceClauseId: clause.id,
        })
      );

      lawyerQuestions.push(
        ChecklistItemSchema.parse({
          id: `q_${itemCounter++}`,
          text: "Is this post-termination non-compete restraint void as a matter of law under Section 27 of the Indian Contract Act, 1872?",
          kind: "lawyer_question",
          sourceClauseId: clause.id,
        })
      );
      statutoryCitationsSet.add(
        "Indian Contract Act, 1872 (Sec 27: Agreement in Restraint of Trade Void)"
      );
    }

    // Specific Action & Question for Uncapped Indemnity
    else if (typeLower.includes("indemnity") || /indemnif|liabilit/i.test(textLower)) {
      actionItems.push(
        ChecklistItemSchema.parse({
          id: `act_${itemCounter++}`,
          text: "Request a liability cap limiting total claims to fees received over the preceding 3 to 6 months.",
          kind: "action",
          sourceClauseId: clause.id,
        })
      );

      lawyerQuestions.push(
        ChecklistItemSchema.parse({
          id: `q_${itemCounter++}`,
          text: "Can the other party enforce unilateral uncapped indemnification against an individual contractor for third-party claims without proving gross negligence?",
          kind: "lawyer_question",
          sourceClauseId: clause.id,
        })
      );
      statutoryCitationsSet.add("Indian Contract Act, 1872 (Sec 124: Contract of Indemnity)");
    }

    // Generic High-Risk Fallback
    else {
      actionItems.push(
        ChecklistItemSchema.parse({
          id: `act_${itemCounter++}`,
          text: `Request formal clarification and written modification of ${clause.type.replace(/_/g, " ")}: "${clause.plainSummary}".`,
          kind: "action",
          sourceClauseId: clause.id,
        })
      );

      lawyerQuestions.push(
        ChecklistItemSchema.parse({
          id: `q_${itemCounter++}`,
          text: `Does the phrasing in Clause ${clause.id} (${clause.type.replace(/_/g, " ")}) expose me to disproportionate legal or financial exposure?`,
          kind: "lawyer_question",
          sourceClauseId: clause.id,
        })
      );
    }
  });

  // 2. Process Caution Clauses (e.g. Deposit)
  cautionClauses.forEach((clause) => {
    const typeLower = clause.type.toLowerCase();
    const textLower = clause.sourceText.toLowerCase();

    if (typeLower.includes("deposit") || /deposit|security/i.test(textLower)) {
      actionItems.push(
        ChecklistItemSchema.parse({
          id: `act_${itemCounter++}`,
          text: "Obtain a stamped or bank-transferred receipt for the security deposit explicitly noting the refund timeline (e.g., within 30 days of vacation).",
          kind: "action",
          sourceClauseId: clause.id,
        })
      );

      lawyerQuestions.push(
        ChecklistItemSchema.parse({
          id: `q_${itemCounter++}`,
          text: "Under the Model Tenancy Act, 2021 (Sec 11), residential security deposit is capped at 2 months rent. Can the excess deposit requested here be challenged?",
          kind: "lawyer_question",
          sourceClauseId: clause.id,
        })
      );
      statutoryCitationsSet.add("Model Tenancy Act, 2021 (Sec 11: Security Deposit Ceiling)");
    }
  });

  // 3. Add General Due-Diligence Actions
  actionItems.push(
    ChecklistItemSchema.parse({
      id: `act_${itemCounter++}`,
      text: "Verify counterparty credentials and inspect government-issued identification prior to signing.",
      kind: "action",
      sourceClauseId: null,
    }),
    ChecklistItemSchema.parse({
      id: `act_${itemCounter++}`,
      text: "Ensure every oral representation or physical amenity promise is attached as a signed annexure.",
      kind: "action",
      sourceClauseId: null,
    })
  );

  // 4. Incorporate Citizen-Bookmarked Questions from Consultation Desk
  bookmarkedQuestions.forEach((qText) => {
    lawyerQuestions.push(
      ChecklistItemSchema.parse({
        id: `q_${itemCounter++}`,
        text: qText.startsWith("Question:") ? qText.replace(/^Question:\s*/i, "") : qText,
        kind: "lawyer_question",
        sourceClauseId: null,
      })
    );
  });

  // If no high-risk clauses were extracted, provide baseline consultation questions
  if (lawyerQuestions.length === 0) {
    lawyerQuestions.push(
      ChecklistItemSchema.parse({
        id: `q_${itemCounter++}`,
        text: "Are there any hidden automatic renewal or unilateral modification provisions in this agreement?",
        kind: "lawyer_question",
        sourceClauseId: null,
      }),
      ChecklistItemSchema.parse({
        id: `q_${itemCounter++}`,
        text: "Which court or arbitration jurisdiction governs dispute resolution under this agreement?",
        kind: "lawyer_question",
        sourceClauseId: null,
      })
    );
  }

  const caseRef = `NS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    id: `memo_${Date.now()}`,
    documentTitle: doc.filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
    documentFilename: doc.filename,
    generatedDate: new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    caseReference: caseRef,
    totalClauses: clauses.length,
    highRiskCount: highRiskClauses.length,
    cautionCount: cautionClauses.length,
    actionItems,
    lawyerQuestions,
    statutoryCitations: Array.from(statutoryCitationsSet),
  };
}
