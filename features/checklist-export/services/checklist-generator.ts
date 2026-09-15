import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { ChecklistItemSchema, type ChecklistItem, type LegalMemo } from "../types";

// ---------------------------------------------------------------------------
// Clause-type categorisation
// ---------------------------------------------------------------------------
// Maps the AI-generated clause type string to a canonical internal category.
// This is the single gating layer — the citation/question logic below uses
// only these categories, so a lock-in clause never leaks into the TPA branch.

type ClauseCategory =
  | "termination_notice" // genuine notice-period / termination clauses
  | "lock_in_penalty" // lock-in periods, early-exit fees, forfeiture
  | "rent_escalation" // rent increase / escalation provisions
  | "security_deposit" // deposit collection, refund conditions
  | "indemnity_liability" // indemnification, uncapped liability
  | "non_compete" // restraint of trade, non-compete covenants
  | "deactivation" // platform account suspension / deactivation
  | "dispute_resolution" // arbitration, jurisdiction clauses
  | "other"; // catch-all

function getClauseCategory(clause: Clause): ClauseCategory {
  const type = clause.type.toLowerCase().replace(/[\s-]/g, "_");
  const text = clause.sourceText.toLowerCase();

  // ── Lock-in / penalty ────────────────────────────────────────────────────
  // Must be checked BEFORE termination_notice to prevent "lock_in" clauses
  // that mention "notice" from falling into the TPA branch.
  if (
    type.includes("lock_in") ||
    type.includes("lockin") ||
    type.includes("lock-in") ||
    type.includes("penalty") ||
    type.includes("early_exit") ||
    type.includes("forfeiture") ||
    type.includes("liquidated") ||
    /\block.?in\b/.test(text) ||
    /early.?exit|early.?terminat/.test(text) ||
    /forfeit|penalt[yi]|liquidated.?damage/.test(text)
  ) {
    return "lock_in_penalty";
  }

  // ── Rent escalation ───────────────────────────────────────────────────────
  if (
    type.includes("escalat") ||
    type.includes("rent_increase") ||
    type.includes("rental_increase") ||
    type.includes("revision") ||
    /escalat|rent.?increase|annual.?increase|hike/.test(text)
  ) {
    return "rent_escalation";
  }

  // ── Genuine termination / notice-period clauses ──────────────────────────
  // Only fires when the clause is specifically ABOUT giving notice to terminate,
  // not when another clause type merely mentions notice in passing.
  if (
    type.includes("notice_period") ||
    type.includes("termination_notice") ||
    type === "notice" ||
    type === "termination" ||
    type.includes("eviction")
  ) {
    return "termination_notice";
  }

  // ── Security deposit ─────────────────────────────────────────────────────
  if (
    type.includes("deposit") ||
    type.includes("security") ||
    /security.?deposit|caution.?deposit/.test(text)
  ) {
    return "security_deposit";
  }

  // ── Indemnity / liability ─────────────────────────────────────────────────
  if (
    type.includes("indemnity") ||
    type.includes("liability") ||
    /indemnif|hold.?harmless|uncapped/.test(text)
  ) {
    return "indemnity_liability";
  }

  // ── Non-compete / restraint ───────────────────────────────────────────────
  if (
    type.includes("non_compete") ||
    type.includes("restraint") ||
    /non.?compete|restraint.?of.?trade|non.?solicitation/.test(text)
  ) {
    return "non_compete";
  }

  // ── Account deactivation ──────────────────────────────────────────────────
  if (type.includes("deactivation") || /deactivat|suspen|block/.test(text)) {
    return "deactivation";
  }

  // ── Dispute resolution ────────────────────────────────────────────────────
  if (type.includes("dispute") || type.includes("arbitration") || type.includes("jurisdiction")) {
    return "dispute_resolution";
  }

  return "other";
}

// ---------------------------------------------------------------------------
// Memo generation
// ---------------------------------------------------------------------------

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

  // ── 1. High-risk clauses ─────────────────────────────────────────────────
  highRiskClauses.forEach((clause) => {
    const category = getClauseCategory(clause);

    switch (category) {
      // ── Genuine termination / notice-period asymmetry ─────────────────────
      case "termination_notice": {
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
            text: `Is the asymmetric notice provision ("${clause.plainSummary}") legally enforceable? Under Section 106 of the Transfer of Property Act, 1882, monthly tenancies require at minimum 15 days' notice from either side — does this clause meet or restrict that statutory floor?`,
            kind: "lawyer_question",
            sourceClauseId: clause.id,
          })
        );
        statutoryCitationsSet.add("Transfer of Property Act, 1882 (Sec 106 — Notice to Quit)");
        statutoryCitationsSet.add("Model Tenancy Act, 2021 (Reciprocal Termination Rights)");
        break;
      }

      // ── Lock-in / early-exit penalty ──────────────────────────────────────
      // Cite ICA Sec 74 (liquidated damages) — NOT TPA Sec 106.
      case "lock_in_penalty": {
        actionItems.push(
          ChecklistItemSchema.parse({
            id: `act_${itemCounter++}`,
            text: "Calculate the worst-case early-exit forfeiture amount before signing and confirm it represents a genuine pre-estimate of loss, not a penalty disguised as liquidated damages.",
            kind: "action",
            sourceClauseId: clause.id,
          })
        );
        lawyerQuestions.push(
          ChecklistItemSchema.parse({
            id: `q_${itemCounter++}`,
            text: `The lock-in / early-exit clause states: "${clause.plainSummary}". Under Section 74 of the Indian Contract Act, 1872, a court may award only 'reasonable compensation' even where a pre-fixed penalty amount is stipulated — is the amount here disproportionate such that a court would reduce it?`,
            kind: "lawyer_question",
            sourceClauseId: clause.id,
          })
        );
        statutoryCitationsSet.add(
          "Indian Contract Act, 1872 (Sec 74 — Liquidated Damages & Penalty Clause Reasonableness)"
        );
        break;
      }

      // ── Rent escalation ───────────────────────────────────────────────────
      // No blanket statute governs residential rent escalation nationally.
      // Cite state Rent Control Acts only if the document is clearly residential.
      case "rent_escalation": {
        actionItems.push(
          ChecklistItemSchema.parse({
            id: `act_${itemCounter++}`,
            text: `Cap the escalation rate in writing: counter-propose a fixed annual increment not exceeding 5–8 % or CPI-linked, whichever is lower. "${clause.plainSummary}".`,
            kind: "action",
            sourceClauseId: clause.id,
          })
        );
        lawyerQuestions.push(
          ChecklistItemSchema.parse({
            id: `q_${itemCounter++}`,
            text: `The rent-escalation clause provides: "${clause.plainSummary}". Is this rate commercially reasonable, and does the applicable State Rent Control Act impose any ceiling on annual rent increases for this category of premises?`,
            kind: "lawyer_question",
            sourceClauseId: clause.id,
          })
        );
        // Only add a citation if the document subject matter warrants it —
        // no citation is better than a wrong citation.
        statutoryCitationsSet.add(
          "State Rent Control Act (applicable state — confirm jurisdiction before relying)"
        );
        break;
      }

      // ── Uncapped indemnity ────────────────────────────────────────────────
      case "indemnity_liability": {
        actionItems.push(
          ChecklistItemSchema.parse({
            id: `act_${itemCounter++}`,
            text: "Request a liability cap limiting total claims to fees received over the preceding 3–6 months and require mutual indemnification.",
            kind: "action",
            sourceClauseId: clause.id,
          })
        );
        lawyerQuestions.push(
          ChecklistItemSchema.parse({
            id: `q_${itemCounter++}`,
            text: "Can uncapped unilateral indemnification be enforced against an individual without proving gross negligence, and is this consistent with Section 124 of the Indian Contract Act, 1872?",
            kind: "lawyer_question",
            sourceClauseId: clause.id,
          })
        );
        statutoryCitationsSet.add("Indian Contract Act, 1872 (Sec 124 — Contract of Indemnity)");
        break;
      }

      // ── Non-compete ───────────────────────────────────────────────────────
      case "non_compete": {
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
          "Indian Contract Act, 1872 (Sec 27 — Agreement in Restraint of Trade Void)"
        );
        break;
      }

      // ── Account deactivation ──────────────────────────────────────────────
      case "deactivation": {
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
        break;
      }

      // ── Generic high-risk fallback ────────────────────────────────────────
      default: {
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
        break;
      }
    }
  });

  // ── 2. Caution clauses ───────────────────────────────────────────────────
  cautionClauses.forEach((clause) => {
    const category = getClauseCategory(clause);

    if (category === "security_deposit") {
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
          text: "Under the Model Tenancy Act, 2021 (Sec 11), residential security deposit is capped at 2 months' rent. Can the excess deposit requested here be challenged?",
          kind: "lawyer_question",
          sourceClauseId: clause.id,
        })
      );
      statutoryCitationsSet.add("Model Tenancy Act, 2021 (Sec 11 — Security Deposit Ceiling)");
    }

    if (category === "rent_escalation") {
      actionItems.push(
        ChecklistItemSchema.parse({
          id: `act_${itemCounter++}`,
          text: `Confirm the escalation formula in writing and request a hard cap: "${clause.plainSummary}".`,
          kind: "action",
          sourceClauseId: clause.id,
        })
      );
    }

    if (category === "lock_in_penalty") {
      actionItems.push(
        ChecklistItemSchema.parse({
          id: `act_${itemCounter++}`,
          text: `Note the lock-in period and early-exit cost before committing: "${clause.plainSummary}". Negotiate a pro-rata refund rather than full forfeiture.`,
          kind: "action",
          sourceClauseId: clause.id,
        })
      );
      statutoryCitationsSet.add(
        "Indian Contract Act, 1872 (Sec 74 — Liquidated Damages & Penalty Clause Reasonableness)"
      );
    }
  });

  // ── 3. General due-diligence actions ─────────────────────────────────────
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

  // ── 4. Citizen-bookmarked questions from Consultation Desk ───────────────
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

  // ── 5. Baseline questions if no high-risk clauses ────────────────────────
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
