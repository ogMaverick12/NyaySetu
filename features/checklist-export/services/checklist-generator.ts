import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause, detectDocumentType, type DocumentType } from "@/features/extraction";
import { ChecklistItemSchema, type ChecklistItem, type LegalMemo } from "../types";

// ---------------------------------------------------------------------------
// ID-leak guard & sanitization
// ---------------------------------------------------------------------------
// Patterns that match raw internal identifiers (e.g. cl_4, lawyer_q_1789477754541, cl_test_custom).
// An internal ID must NEVER render in user-facing text or exported memos.
export const RAW_ID_PATTERN = /^(cl_\w+|act_\w+|q_\w+|item_\w+|lawyer_q_\w+|memo_\w+|doc_\w+)$/i;

export const EMBEDDED_ID_PATTERN = /\b(cl_\w+|lawyer_q_\w+|act_\w+|q_\w+|item_\w+|memo_\w+)\b/gi;

/**
 * Checks whether a text string is or starts with a raw internal ID.
 */
export function isInternalId(text: string | null | undefined): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  return !trimmed || RAW_ID_PATTERN.test(trimmed);
}

/**
 * Formats a raw clause type into a human-readable name.
 * e.g. "notice_period" -> "notice period", "lock_in" -> "lock in"
 */
export function formatClauseType(type?: string): string {
  if (!type) return "contract";
  return type.replace(/[_-]/g, " ").trim();
}

/**
 * Builds the canonical generic templated question as requested:
 * "Ask your lawyer about the [clause type] clause"
 */
export function genericTemplatedQuestion(clauseType?: string): string {
  const typeName = formatClauseType(clauseType);
  return `Ask your lawyer about the ${typeName} clause`;
}

/**
 * Builds a generic templated action item:
 * "Review the [clause type] clause carefully before signing"
 */
export function genericTemplatedAction(clauseType?: string): string {
  const typeName = formatClauseType(clauseType);
  return `Review the ${typeName} clause carefully before signing`;
}

/**
 * Scrubs any embedded internal IDs from user-facing text.
 * e.g. "phrasing in Clause cl_4" -> "phrasing in Clause 4"
 */
export function scrubEmbeddedIds(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/clause\s+cl_(\d+)/gi, "Clause $1");
  cleaned = cleaned.replace(/\bcl_(\d+)\b/gi, "Clause $1");
  cleaned = cleaned.replace(/\blawyer_q_\w+\b/gi, "consultation question");
  cleaned = cleaned.replace(/\bact_\w+\b/gi, "action item");
  cleaned = cleaned.replace(/\bitem_\w+\b/gi, "item");
  return cleaned.trim();
}

/**
 * Sanitizes a generated text string before it reaches the UI or export.
 * If the text is an internal ID or empty, it substitutes the safe fallback.
 */
export function sanitizeText(text: string | null | undefined, fallback: string): string {
  if (!text) return fallback;
  const trimmed = text.trim();
  if (!trimmed || RAW_ID_PATTERN.test(trimmed)) {
    return fallback;
  }
  const scrubbed = scrubEmbeddedIds(trimmed);
  if (!scrubbed || RAW_ID_PATTERN.test(scrubbed)) {
    return fallback;
  }
  return scrubbed;
}

/**
 * Executes question generation with a single retry on failure,
 * then falls back to the generic templated question ("Ask your lawyer about the [clause type] clause").
 */
export function generateQuestionWithRetry(clause: Clause, primaryGenerator: () => string): string {
  const clauseType = formatClauseType(clause.type);
  const summary = clause.plainSummary?.trim();
  const summaryIsId = isInternalId(summary) || (summary ? RAW_ID_PATTERN.test(summary) : true);

  // Attempt 1: Primary generation (only if summary is not an ID)
  if (!summaryIsId) {
    try {
      const candidate = primaryGenerator();
      if (candidate && !isInternalId(candidate) && !RAW_ID_PATTERN.test(candidate)) {
        if (!/\b(cl_\w+|lawyer_q_\w+)\b/i.test(candidate)) {
          return scrubEmbeddedIds(candidate);
        }
      }
    } catch {
      // Attempt 1 threw an error - proceed to retry
    }
  }

  // Attempt 2: Retry once with alternative structured formulation (only if valid summary exists)
  if (!summaryIsId && summary) {
    try {
      const retryCandidate = `Is the ${clauseType} provision ("${summary.slice(0, 100)}${summary.length > 100 ? "…" : ""}") legally enforceable under applicable law?`;
      if (retryCandidate && !/\b(cl_\w+|lawyer_q_\w+)\b/i.test(retryCandidate)) {
        return scrubEmbeddedIds(retryCandidate);
      }
    } catch {
      // Retry also failed - proceed to final fallback
    }
  }

  // Final Fallback: Generic templated question as mandated by requirements
  return genericTemplatedQuestion(clauseType);
}

/**
 * Executes action generation with a single retry on failure,
 * then falls back to generic templated action.
 */
export function generateActionWithRetry(clause: Clause, primaryGenerator: () => string): string {
  const clauseType = formatClauseType(clause.type);
  const summary = clause.plainSummary?.trim();
  const summaryIsId = isInternalId(summary) || (summary ? RAW_ID_PATTERN.test(summary) : true);

  // Attempt 1: Primary generation
  if (!summaryIsId) {
    try {
      const candidate = primaryGenerator();
      if (candidate && !isInternalId(candidate) && !RAW_ID_PATTERN.test(candidate)) {
        if (!/\b(cl_\w+|lawyer_q_\w+)\b/i.test(candidate)) {
          return scrubEmbeddedIds(candidate);
        }
      }
    } catch {
      // Attempt 1 threw an error - proceed to retry
    }
  }

  // Attempt 2: Retry once
  if (!summaryIsId && summary) {
    try {
      const retryCandidate = `Review and negotiate balanced terms for the ${clauseType} provision: "${summary.slice(0, 100)}${summary.length > 100 ? "…" : ""}".`;
      if (retryCandidate && !/\b(cl_\w+|lawyer_q_\w+)\b/i.test(retryCandidate)) {
        return scrubEmbeddedIds(retryCandidate);
      }
    } catch {
      // Fall through
    }
  }

  // Final fallback
  return genericTemplatedAction(clauseType);
}

/**
 * Single creation point for all ChecklistItems.
 * Sanitizes the text field before passing to the schema validator —
 * guarantees a raw internal ID can NEVER reach user-facing output.
 */
function makeItem(args: {
  id: string;
  text: string;
  kind: "action" | "lawyer_question";
  sourceClauseId: string | null;
  fallback: string;
}): ChecklistItem {
  return ChecklistItemSchema.parse({
    id: args.id,
    text: sanitizeText(args.text, args.fallback),
    kind: args.kind,
    sourceClauseId: args.sourceClauseId,
  });
}

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

/**
 * Generates the specific lawyer question for a given clause category.
 */
function buildCategoryLawyerQuestion(
  clause: Clause,
  category: ClauseCategory,
  docType: DocumentType = "tenancy"
): string {
  switch (category) {
    case "termination_notice":
      if (docType === "tenancy") {
        return `Is the asymmetric notice provision ("${clause.plainSummary}") legally enforceable? Under Section 106 of the Transfer of Property Act, 1882, monthly tenancies require at minimum 15 days' notice from either side — does this clause meet or restrict that statutory floor?`;
      }
      if (docType === "employment") {
        return `Is the asymmetric notice provision ("${clause.plainSummary}") enforceable under applicable Shops and Establishments regulations, and does it require reciprocal notice from the employer?`;
      }
      return `Is the asymmetric notice provision ("${clause.plainSummary}") legally enforceable against an independent partner or contractor?`;

    case "lock_in_penalty":
      return `The lock-in / early-exit clause states: "${clause.plainSummary}". Under Section 74 of the Indian Contract Act, 1872, a court may award only 'reasonable compensation' even where a pre-fixed penalty amount is stipulated — is the amount here disproportionate such that a court would reduce it?`;

    case "rent_escalation":
      return `The rent-escalation clause provides: "${clause.plainSummary}". Is this rate commercially reasonable, and does the applicable State Rent Control Act impose any ceiling on annual rent increases for this category of premises?`;

    case "indemnity_liability":
      if (docType === "tenancy") {
        return `Can the landlord enforce unilateral uncapped indemnification against the tenant without proving gross negligence, and is this consistent with Section 124 of the Indian Contract Act, 1872?`;
      }
      if (docType === "employment") {
        return `Can the employer hold the employee liable for uncapped indemnity during ordinary employment duties under Section 124 of the Indian Contract Act, 1872?`;
      }
      return `Can uncapped unilateral indemnification be enforced against an individual contractor without proving gross negligence, and is this consistent with Section 124 of the Indian Contract Act, 1872?`;

    case "non_compete":
      return `Is this post-termination non-compete restraint void as a matter of law under Section 27 of the Indian Contract Act, 1872?`;

    case "deactivation":
      if (docType === "tenancy") {
        return `Does the landlord's unilateral lockout, eviction, or deactivation clause violate statutory tenant protections under the applicable Rent Control Act or Model Tenancy Act?`;
      }
      if (docType === "employment") {
        return `Does the employer's unilateral termination clause violate the Industrial Disputes Act, 1947 or principles of natural justice?`;
      }
      return `Does the platform's unilateral deactivation clause violate natural justice or the fair contract principles outlined in the Fairwork India 2020 guidelines?`;

    case "security_deposit":
      return `Under the Model Tenancy Act, 2021 (Sec 11), residential security deposit is capped at 2 months' rent. Can the excess deposit requested here be challenged?`;

    default:
      return `Does the ${formatClauseType(clause.type)} clause ("${clause.plainSummary.slice(0, 80)}…") expose me to disproportionate legal or financial exposure?`;
  }
}

/**
 * Generates the specific action item for a given clause category.
 */
function buildCategoryAction(
  clause: Clause,
  category: ClauseCategory,
  docType: DocumentType = "tenancy"
): string {
  switch (category) {
    case "termination_notice":
      if (docType === "tenancy") {
        return "Negotiate equal reciprocal notice: propose an identical 30-day termination notice requirement for both tenant and landlord in writing.";
      }
      if (docType === "employment") {
        return "Negotiate equal reciprocal notice: propose an identical 30-day termination notice requirement for both employee and employer in writing.";
      }
      return "Negotiate equal reciprocal notice: propose an identical 30-day termination notice requirement for both parties in writing.";

    case "lock_in_penalty":
      return "Calculate the worst-case early-exit forfeiture amount before signing and confirm it represents a genuine pre-estimate of loss, not a penalty disguised as liquidated damages.";

    case "rent_escalation":
      return `Cap the escalation rate in writing: counter-propose a fixed annual increment not exceeding 5–8 % or CPI-linked, whichever is lower. "${clause.plainSummary}".`;

    case "indemnity_liability":
      if (docType === "tenancy") {
        return "Request a liability cap limiting tenant liability to a defined amount (e.g., 1–2 months' rent) and require mutual indemnification from the landlord for premises claims.";
      }
      if (docType === "employment") {
        return "Request a liability cap limiting employee liability and ensure indemnification excludes ordinary performance of employment duties in good faith.";
      }
      return "Request a liability cap limiting total claims to fees received over the preceding 3–6 months and require mutual indemnification.";

    case "non_compete":
      return "Identify all prospective clients or geographic areas affected by the restrictive covenant before entering post-contract commitments.";

    case "deactivation":
      if (docType === "tenancy") {
        return "Maintain written receipts of rent payments and documented inspection records to contest any arbitrary lockout or unlawful eviction.";
      }
      if (docType === "employment") {
        return "Maintain personal copies of offer letters, appraisals, and written communications to contest arbitrary dismissal.";
      }
      return "Maintain personal offline archives of all delivery logs, dispute records, and customer ratings to contest arbitrary account suspension.";

    case "security_deposit":
      return "Obtain a stamped or bank-transferred receipt for the security deposit explicitly noting the refund timeline (e.g., within 30 days of vacation).";

    default:
      return `Request formal clarification and written modification of ${formatClauseType(clause.type)}: "${clause.plainSummary}".`;
  }
}

// ---------------------------------------------------------------------------
// Memo generation
// ---------------------------------------------------------------------------

export function generateLegalMemo(
  doc: ParsedDocument,
  clauses: Clause[],
  bookmarkedQuestions: string[] = [],
  documentType?: DocumentType
): LegalMemo {
  const docType: DocumentType = documentType || detectDocumentType(doc);
  const highRiskClauses = clauses.filter((c) => c.riskLevel === "high-risk");
  const cautionClauses = clauses.filter((c) => c.riskLevel === "caution");

  const actionItems: ChecklistItem[] = [];
  const lawyerQuestions: ChecklistItem[] = [];
  const statutoryCitationsSet = new Set<string>();

  let itemCounter = 1;

  // ── 1. High-risk clauses ─────────────────────────────────────────────────
  highRiskClauses.forEach((clause) => {
    const category = getClauseCategory(clause);

    // Generate action with retry and generic templated fallback
    const actionText = generateActionWithRetry(clause, () =>
      buildCategoryAction(clause, category, docType)
    );
    actionItems.push(
      makeItem({
        id: `act_${itemCounter++}`,
        text: actionText,
        kind: "action",
        sourceClauseId: clause.id,
        fallback: genericTemplatedAction(clause.type),
      })
    );

    // Generate question with retry and generic templated fallback
    const questionText = generateQuestionWithRetry(clause, () =>
      buildCategoryLawyerQuestion(clause, category, docType)
    );
    lawyerQuestions.push(
      makeItem({
        id: `q_${itemCounter++}`,
        text: questionText,
        kind: "lawyer_question",
        sourceClauseId: clause.id,
        fallback: genericTemplatedQuestion(clause.type),
      })
    );

    // Add appropriate statutory citations based on verified category & document type
    switch (category) {
      case "termination_notice":
        if (docType === "tenancy") {
          statutoryCitationsSet.add("Transfer of Property Act, 1882 (Sec 106 — Notice to Quit)");
          statutoryCitationsSet.add("Model Tenancy Act, 2021 (Reciprocal Termination Rights)");
        } else if (docType === "employment") {
          statutoryCitationsSet.add("State Shops and Establishments Act (Notice of Termination)");
        } else {
          statutoryCitationsSet.add("Indian Contract Act, 1872 (Sec 73 — Breach and Notice)");
          statutoryCitationsSet.add("Fairwork India Principles (Fair Contracts)");
        }
        break;
      case "lock_in_penalty":
        statutoryCitationsSet.add(
          "Indian Contract Act, 1872 (Sec 74 — Liquidated Damages & Penalty Clause Reasonableness)"
        );
        break;
      case "rent_escalation":
        statutoryCitationsSet.add(
          "State Rent Control Act (applicable state — confirm jurisdiction before relying)"
        );
        break;
      case "indemnity_liability":
        statutoryCitationsSet.add("Indian Contract Act, 1872 (Sec 124 — Contract of Indemnity)");
        break;
      case "non_compete":
        statutoryCitationsSet.add(
          "Indian Contract Act, 1872 (Sec 27 — Agreement in Restraint of Trade Void)"
        );
        break;
      case "deactivation":
        if (docType === "tenancy") {
          statutoryCitationsSet.add(
            "Model Tenancy Act, 2021 (Sec 21 — Protection Against Unlawful Eviction)"
          );
        } else if (docType === "employment") {
          statutoryCitationsSet.add(
            "Industrial Disputes Act, 1947 (Dispute Resolution & Natural Justice)"
          );
        } else {
          statutoryCitationsSet.add("Fairwork India Principles (Fair Contracts & Appeals)");
        }
        break;
    }
  });

  // ── 2. Caution clauses ───────────────────────────────────────────────────
  cautionClauses.forEach((clause) => {
    const category = getClauseCategory(clause);

    if (category === "security_deposit") {
      actionItems.push(
        makeItem({
          id: `act_${itemCounter++}`,
          text: generateActionWithRetry(clause, () =>
            buildCategoryAction(clause, category, docType)
          ),
          kind: "action",
          sourceClauseId: clause.id,
          fallback: genericTemplatedAction(clause.type),
        })
      );
      lawyerQuestions.push(
        makeItem({
          id: `q_${itemCounter++}`,
          text: generateQuestionWithRetry(clause, () =>
            buildCategoryLawyerQuestion(clause, category, docType)
          ),
          kind: "lawyer_question",
          sourceClauseId: clause.id,
          fallback: genericTemplatedQuestion(clause.type),
        })
      );
      statutoryCitationsSet.add("Model Tenancy Act, 2021 (Sec 11 — Security Deposit Ceiling)");
    }

    if (category === "rent_escalation") {
      actionItems.push(
        makeItem({
          id: `act_${itemCounter++}`,
          text: generateActionWithRetry(
            clause,
            () =>
              `Confirm the escalation formula in writing and request a hard cap: "${clause.plainSummary}".`
          ),
          kind: "action",
          sourceClauseId: clause.id,
          fallback: genericTemplatedAction(clause.type),
        })
      );
    }

    if (category === "lock_in_penalty") {
      actionItems.push(
        makeItem({
          id: `act_${itemCounter++}`,
          text: generateActionWithRetry(
            clause,
            () =>
              `Note the lock-in period and early-exit cost before committing: "${clause.plainSummary}". Negotiate a pro-rata refund rather than full forfeiture.`
          ),
          kind: "action",
          sourceClauseId: clause.id,
          fallback: genericTemplatedAction(clause.type),
        })
      );
      statutoryCitationsSet.add(
        "Indian Contract Act, 1872 (Sec 74 — Liquidated Damages & Penalty Clause Reasonableness)"
      );
    }
  });

  // ── 3. General due-diligence actions ─────────────────────────────────────
  actionItems.push(
    makeItem({
      id: `act_${itemCounter++}`,
      text: "Verify counterparty credentials and inspect government-issued identification prior to signing.",
      kind: "action",
      sourceClauseId: null,
      fallback: "Verify the identity of all parties before signing.",
    }),
    makeItem({
      id: `act_${itemCounter++}`,
      text: "Ensure every oral representation or physical amenity promise is attached as a signed annexure.",
      kind: "action",
      sourceClauseId: null,
      fallback: "Ensure all verbal promises are documented in writing.",
    })
  );

  // ── 4. Citizen-bookmarked questions from Consultation Desk / Flagged clauses ──
  bookmarkedQuestions.forEach((qText) => {
    if (!qText || !qText.trim()) return;
    const trimmed = qText.trim();

    // Check if qText matches a known clause ID (e.g. "cl_4", "cl_1")
    const matchedClause = clauses.find((c) => c.id.toLowerCase() === trimmed.toLowerCase());

    if (matchedClause) {
      // Don't add duplicate question if already added for this clause
      const alreadyHasQuestion = lawyerQuestions.some((q) => q.sourceClauseId === matchedClause.id);
      if (alreadyHasQuestion) return;

      const cat = getClauseCategory(matchedClause);
      const generated = generateQuestionWithRetry(matchedClause, () =>
        buildCategoryLawyerQuestion(matchedClause, cat, docType)
      );

      lawyerQuestions.push(
        makeItem({
          id: `q_${itemCounter++}`,
          text: generated,
          kind: "lawyer_question",
          sourceClauseId: matchedClause.id,
          fallback: genericTemplatedQuestion(matchedClause.type),
        })
      );
      return;
    }

    // Check if qText itself is an internal identifier (e.g. "cl_4" without matching clause, or "lawyer_q_1789477754541")
    if (isInternalId(trimmed)) {
      // Attempt 1 failed (raw ID was passed). Retry once: check if it contains a clause type hint or number
      let resolvedText: string | null = null;
      const clNumMatch = trimmed.match(/^cl_(\d+)$/i);
      if (clNumMatch) {
        resolvedText = `Ask your lawyer about clause ${clNumMatch[1]}`;
      }

      // If retry failed or still an internal ID, fall back to generic templated question
      if (!resolvedText || isInternalId(resolvedText)) {
        resolvedText = genericTemplatedQuestion();
      }

      lawyerQuestions.push(
        makeItem({
          id: `q_${itemCounter++}`,
          text: resolvedText,
          kind: "lawyer_question",
          sourceClauseId: null,
          fallback: genericTemplatedQuestion(),
        })
      );
      return;
    }

    // It is genuine question text (e.g. from Consultation Q&A)
    const cleaned = trimmed.replace(/^Question:\s*/i, "").trim();
    const scrubbed = scrubEmbeddedIds(cleaned);

    // Final guard: ensure no internal ID can ever render
    const finalText = isInternalId(scrubbed) || !scrubbed ? genericTemplatedQuestion() : scrubbed;

    lawyerQuestions.push(
      makeItem({
        id: `q_${itemCounter++}`,
        text: finalText,
        kind: "lawyer_question",
        sourceClauseId: null,
        fallback: genericTemplatedQuestion(),
      })
    );
  });

  // ── 5. Baseline questions if no high-risk clauses ────────────────────────
  if (lawyerQuestions.length === 0) {
    lawyerQuestions.push(
      makeItem({
        id: `q_${itemCounter++}`,
        text: "Are there any hidden automatic renewal or unilateral modification provisions in this agreement?",
        kind: "lawyer_question",
        sourceClauseId: null,
        fallback: "Ask your lawyer whether there are automatic renewal clauses.",
      }),
      makeItem({
        id: `q_${itemCounter++}`,
        text: "Which court or arbitration jurisdiction governs dispute resolution under this agreement?",
        kind: "lawyer_question",
        sourceClauseId: null,
        fallback: "Ask your lawyer which jurisdiction governs disputes under this agreement.",
      })
    );
  }

  // ── 6. Deduplicate action items & lawyer questions by generated text ─────
  const dedupedActionItems: ChecklistItem[] = [];
  const seenActionTexts = new Set<string>();
  for (const item of actionItems) {
    const normalized = item.text.trim().toLowerCase();
    if (!seenActionTexts.has(normalized)) {
      seenActionTexts.add(normalized);
      dedupedActionItems.push(item);
    }
  }
  const finalActionItems = dedupedActionItems.map((item, idx) => ({
    ...item,
    id: `act_${idx + 1}`,
  }));

  const dedupedLawyerQuestions: ChecklistItem[] = [];
  const seenQuestionTexts = new Set<string>();
  for (const item of lawyerQuestions) {
    const normalized = item.text.trim().toLowerCase();
    if (!seenQuestionTexts.has(normalized)) {
      seenQuestionTexts.add(normalized);
      dedupedLawyerQuestions.push(item);
    }
  }
  const finalLawyerQuestions = dedupedLawyerQuestions.map((item, idx) => ({
    ...item,
    id: `q_${idx + 1}`,
  }));

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
    actionItems: finalActionItems,
    lawyerQuestions: finalLawyerQuestions,
    statutoryCitations: Array.from(statutoryCitationsSet),
  };
}
