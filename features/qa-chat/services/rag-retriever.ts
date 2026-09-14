import { type ParsedDocument } from "@/features/ingestion/types";
import { type Clause } from "@/features/extraction/types";
import { type DocumentContextChunk, type QAResponsePayload } from "../types";

/**
 * Stopwords to filter during keyword extraction
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "of",
  "to",
  "for",
  "with",
  "and",
  "or",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "what",
  "which",
  "who",
  "whom",
  "this",
  "that",
  "these",
  "those",
  "am",
  "it",
  "its",
  "can",
  "could",
  "will",
  "would",
  "should",
  "my",
  "your",
  "our",
  "their",
  "there",
  "how",
  "when",
  "where",
  "why",
  "about",
]);

/**
 * Tokenizes text into normalized keywords.
 */
export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

/**
 * Decomposes a parsed document into page-anchored context chunks.
 */
export function chunkDocument(doc: ParsedDocument): DocumentContextChunk[] {
  const chunks: DocumentContextChunk[] = [];

  doc.pages.forEach((page) => {
    // Split page text by double newlines or paragraph breaks
    const paragraphs = page.text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    if (paragraphs.length === 0 && page.text.trim().length > 0) {
      chunks.push({
        id: `chunk_p${page.pageNumber}_1`,
        page: page.pageNumber,
        text: page.text.trim(),
      });
    } else {
      paragraphs.forEach((p, idx) => {
        chunks.push({
          id: `chunk_p${page.pageNumber}_${idx + 1}`,
          page: page.pageNumber,
          text: p,
        });
      });
    }
  });

  return chunks;
}

/**
 * In-memory RAG retrieval: scores chunks and clauses against user query keywords.
 */
export function retrieveRelevantContext(
  doc: ParsedDocument,
  question: string,
  clauses?: Clause[],
  topK = 4
): DocumentContextChunk[] {
  const queryTokens = extractKeywords(question);
  if (queryTokens.length === 0) {
    return [];
  }

  const chunks = chunkDocument(doc);

  // Score document chunks
  const scoredChunks = chunks.map((chunk) => {
    const chunkTokens = extractKeywords(chunk.text);
    let matchScore = 0;

    queryTokens.forEach((token) => {
      const occurrences = chunkTokens.filter((t) => t.includes(token) || token.includes(t)).length;
      matchScore += occurrences;
    });

    return { chunk, score: matchScore };
  });

  // Also score against clauses if available
  if (clauses && clauses.length > 0) {
    clauses.forEach((c) => {
      const clauseTokens = extractKeywords(`${c.type} ${c.plainSummary} ${c.sourceText}`);
      let matchScore = 0;
      queryTokens.forEach((token) => {
        const occurrences = clauseTokens.filter(
          (t) => t.includes(token) || token.includes(t)
        ).length;
        matchScore += occurrences * 2; // Weight structured clauses higher
      });

      if (matchScore > 0) {
        scoredChunks.push({
          chunk: {
            id: `clause_${c.id}`,
            page: c.page,
            clauseId: c.id,
            title: c.type.replace(/_/g, " "),
            text: `[${c.type.toUpperCase()}] ${c.plainSummary}: "${c.sourceText}"`,
          },
          score: matchScore,
        });
      }
    });
  }

  return scoredChunks
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => item.chunk);
}

/**
 * Deterministic consultation synthesizer for offline/fixture mode.
 * Evaluates in-scope vs out-of-scope questions and supplies exact page citations.
 */
export function evaluateDeterministicQA(
  doc: ParsedDocument,
  question: string,
  clauses?: Clause[]
): QAResponsePayload {
  const queryLower = question.toLowerCase();
  const queryKeywords = extractKeywords(question);

  // 0. Strict Out-of-Scope Boundary Check (PRD F5 Acceptance Criterion)
  const OUT_OF_SCOPE_MARKERS = [
    "criminal",
    "police",
    "jail",
    "prison",
    "sue",
    "lawsuit",
    "court case",
    "defamation",
    "murder",
    "assault",
    "divorce",
    "custody",
    "bail",
    "ipc",
    "fir",
    "weather",
    "recipe",
    "capital of",
    "football",
    "cricket",
  ];

  if (OUT_OF_SCOPE_MARKERS.some((marker) => queryLower.includes(marker))) {
    return {
      isCovered: false,
      answer: "This topic is not covered in the provided document.",
      citations: [],
      lawyerPrepSuggestion:
        "This question falls outside the provisions of this agreement. We recommend adding this question to your Lawyer-Prep Checklist for consultation with a qualified legal professional.",
    };
  }

  // Cross-domain mismatch check (e.g. asking about employer in a lease agreement)
  const isTenancyDoc = /tenant|landlord|rent|lease/i.test(doc.fullText);
  const isEmploymentDoc = /employer|employee|salary|job/i.test(doc.fullText);

  if (isTenancyDoc && queryKeywords.some((k) => ["employer", "salary", "bonus"].includes(k))) {
    return {
      isCovered: false,
      answer: "This topic is not covered in the provided document.",
      citations: [],
      lawyerPrepSuggestion:
        "This is a tenancy agreement and does not address employment relationships. We recommend adding this question to your Lawyer-Prep Checklist.",
    };
  }

  if (isEmploymentDoc && queryKeywords.some((k) => ["tenant", "landlord", "lease"].includes(k))) {
    return {
      isCovered: false,
      answer: "This topic is not covered in the provided document.",
      citations: [],
      lawyerPrepSuggestion:
        "This is an employment contract and does not cover tenancy terms. We recommend adding this question to your Lawyer-Prep Checklist.",
    };
  }

  // 1. Check for Deposit terms
  if (
    queryKeywords.some((k) => ["deposit", "security", "refund", "advance", "deduction"].includes(k))
  ) {
    const depositClause = clauses?.find(
      (c) => c.type.includes("deposit") || /deposit|security/i.test(c.sourceText)
    );
    const depositMatch = doc.fullText.match(/deposit[^.\n]{10,140}/i);

    if (depositClause || depositMatch) {
      const excerpt = depositClause ? depositClause.sourceText : depositMatch?.[0].trim() || "";
      const page = depositClause ? depositClause.page : 1;

      return {
        isCovered: true,
        answer: depositClause
          ? `The document covers security deposits: ${depositClause.plainSummary}`
          : `The agreement states: "${excerpt}"`,
        citations: [
          {
            page,
            clauseId: depositClause?.id || "sec_deposit",
            clauseTitle: "Security Deposit",
            excerpt,
          },
        ],
      };
    }
  }

  // 2. Check for Notice / Termination terms
  if (
    queryKeywords.some((k) =>
      ["notice", "termination", "terminate", "vacate", "exit", "end"].includes(k)
    )
  ) {
    const noticeClause = clauses?.find(
      (c) =>
        c.type.includes("notice") ||
        c.type.includes("termination") ||
        /notice|terminat/i.test(c.sourceText)
    );
    const noticeMatch = doc.fullText.match(/(?:notice|terminat)[^.\n]{10,140}/i);

    if (noticeClause || noticeMatch) {
      const excerpt = noticeClause ? noticeClause.sourceText : noticeMatch?.[0].trim() || "";
      const page = noticeClause ? noticeClause.page : 1;

      return {
        isCovered: true,
        answer: noticeClause
          ? `The document specifies the following notice requirements: ${noticeClause.plainSummary}`
          : `The agreement specifies notice terms: "${excerpt}"`,
        citations: [
          {
            page,
            clauseId: noticeClause?.id || "sec_notice",
            clauseTitle: "Termination & Notice",
            excerpt,
          },
        ],
      };
    }
  }

  // 3. Check for Deactivation / Platform Account terms
  if (
    queryKeywords.some((k) =>
      ["deactivation", "deactivate", "ban", "block", "suspension", "account"].includes(k)
    )
  ) {
    const deactClause = clauses?.find(
      (c) => c.type.includes("deactivation") || /deactivat|suspen/i.test(c.sourceText)
    );
    const deactMatch = doc.fullText.match(/deactivat[^.\n]{10,140}/i);

    if (deactClause || deactMatch) {
      const excerpt = deactClause ? deactClause.sourceText : deactMatch?.[0].trim() || "";
      const page = deactClause ? deactClause.page : 1;

      return {
        isCovered: true,
        answer: deactClause
          ? `Regarding account deactivation: ${deactClause.plainSummary}`
          : `The agreement provisions on deactivation state: "${excerpt}"`,
        citations: [
          {
            page,
            clauseId: deactClause?.id || "sec_deact",
            clauseTitle: "Account Deactivation",
            excerpt,
          },
        ],
      };
    }
  }

  // 4. Check for Non-Compete / Restraint of Trade
  if (
    queryKeywords.some((k) =>
      ["compete", "competition", "restraint", "solicit", "non-compete"].includes(k)
    )
  ) {
    const compClause = clauses?.find(
      (c) => c.type.includes("compete") || /compete|restraint|solicit/i.test(c.sourceText)
    );
    const compMatch = doc.fullText.match(/compete[^.\n]{10,140}/i);

    if (compClause || compMatch) {
      const excerpt = compClause ? compClause.sourceText : compMatch?.[0].trim() || "";
      const page = compClause ? compClause.page : 1;

      return {
        isCovered: true,
        answer: compClause
          ? `Regarding non-compete covenants: ${compClause.plainSummary}`
          : `The agreement provisions state: "${excerpt}"`,
        citations: [
          {
            page,
            clauseId: compClause?.id || "sec_compete",
            clauseTitle: "Non-Compete Covenant",
            excerpt,
          },
        ],
      };
    }
  }

  // 5. Check for Indemnity / Liability
  if (
    queryKeywords.some((k) =>
      ["indemnity", "indemnify", "liability", "damages", "claims"].includes(k)
    )
  ) {
    const indClause = clauses?.find(
      (c) => c.type.includes("indemnity") || /indemnif|liabilit/i.test(c.sourceText)
    );
    const indMatch = doc.fullText.match(/(?:indemnif|liabilit)[^.\n]{10,140}/i);

    if (indClause || indMatch) {
      const excerpt = indClause ? indClause.sourceText : indMatch?.[0].trim() || "";
      const page = indClause ? indClause.page : 1;

      return {
        isCovered: true,
        answer: indClause
          ? `Regarding liability and indemnity: ${indClause.plainSummary}`
          : `The agreement states: "${excerpt}"`,
        citations: [
          {
            page,
            clauseId: indClause?.id || "sec_indemnity",
            clauseTitle: "Indemnity & Liability",
            excerpt,
          },
        ],
      };
    }
  }

  // 6. Generic search across full text with substantive keyword overlap
  const relevantChunks = retrieveRelevantContext(doc, question, clauses, 1);
  if (relevantChunks.length > 0) {
    const chunk = relevantChunks[0];
    const chunkKeywords = extractKeywords(chunk.text);
    const overlapCount = queryKeywords.filter((k) => chunkKeywords.includes(k)).length;

    // Must match at least 2 substantive keywords to be considered covered
    if (overlapCount >= 2) {
      return {
        isCovered: true,
        answer: `The document addresses this on page ${chunk.page}: ${chunk.text.slice(0, 200)}...`,
        citations: [
          {
            page: chunk.page,
            clauseId: chunk.clauseId,
            clauseTitle: chunk.title || `Page ${chunk.page} excerpt`,
            excerpt: chunk.text.slice(0, 150),
          },
        ],
      };
    }
  }

  // 7. Strict Out-of-Scope boundary (PRD F5 acceptance criterion)
  return {
    isCovered: false,
    answer: "This topic is not covered in the provided document.",
    citations: [],
    lawyerPrepSuggestion:
      "This question falls outside the provisions of this agreement. We recommend adding this question to your Lawyer-Prep Checklist for consultation with a qualified legal professional.",
  };
}
