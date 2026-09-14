# NyaySetu — Product Requirements Document

See `00-MASTER.md` for vision and locked decisions before reading this.

## Problem

Legal information is complex and hard to navigate without professional help. Build a GenAI solution that helps people understand, compare, and navigate legal documents and information — assisting rather than replacing a lawyer.

## Target users and scenarios

1. A tenant uploads a photo of a rental agreement before signing — wants to know if the deposit and notice-period clauses are normal.
2. A delivery-platform worker uploads their partner agreement PDF — wants a plain-language summary and to know what happens on account deactivation.
3. A small trader is comparing two versions of a supplier contract — wants the differences and which version is worse for them.
4. Any of the above wants a one-page list of questions to bring to a free legal-aid clinic.

## Problem-statement coverage

| Brief's use case | Feature |
|---|---|
| Simplifying complex legal documents | Plain-language mode, adjustable reading level |
| Comparing contracts, agreements, policies | Compare mode (doc vs doc, or doc vs baseline) |
| Highlighting clauses, obligations, risks, inconsistencies | Risk & clause scoring |
| Answering questions based on provided documents | Grounded Q&A, scoped to the uploaded document |
| Understanding options and next steps | Checklist generator |
| Generating summaries, checklists, actionable outputs | Summary + checklist export |
| Preparing questions for a legal professional | "Questions for your lawyer" one-pager, PDF export |

Reproduce this table in the README verbatim — it's the fastest way for a grader to confirm alignment.

## Features and acceptance criteria

### F1 — Upload & parse
- User can upload a PDF or a photo (JPG/PNG) of a document.
- System extracts text; photo inputs go through OCR.
- Acceptance: a scanned/photographed document and a native PDF both produce a normalized, page-anchored text representation without manual cleanup.

### F2 — Clause & risk extraction
- System returns a structured list of clauses, each with a plain-language summary, a risk level (`info`/`caution`/`high-risk`), and a rationale.
- Acceptance: extraction is one structured call per document (not one per clause); every `high-risk` clause surfaces the lawyer-escalation prompt in the UI.

### F3 — Plain-language mode
- User can toggle between a simplified reading level and the detailed/legal register.
- Acceptance: toggling doesn't re-run extraction — same data, different rendering.

### F4 — Compare mode
- User can compare two uploaded documents, or one document against a built-in baseline template (starter set: rental agreement, gig-platform partner agreement, employment offer).
- Acceptance: output flags each changed clause as favoring or disadvantaging the user, not just "changed."

### F5 — Grounded Q&A
- User can ask questions about the uploaded document; answers cite the source clause/page.
- Acceptance: a question outside the document's scope gets an explicit "not covered here" response plus a suggestion to use the lawyer-prep flow — never a freeform legal-advice answer.

### F6 — Checklist & export
- System generates an action checklist and a "questions for your lawyer" list seeded from `high-risk` clauses, exportable as a single PDF.
- Acceptance: export works with zero additional user input beyond what's already in the session.

## Non-goals (deliberately out of scope)

- User accounts, login, or multi-session persistence — session-scoped only (see `00-MASTER.md` decision log).
- General legal-advice chat unrelated to an uploaded document.
- Support for document types beyond the starter baseline set at launch (rental, gig-partner, employment offer) — architecture should make adding more straightforward, but don't build a long tail up front.

Non-goals exist to protect code quality: every additional subsystem is another place to lose points. Don't add scope back in without updating this document first.

## Definition of done for submission

- All six features working end-to-end on the deployed link.
- README containing the coverage table above, the services-utilized list (per `00-MASTER.md`), and setup instructions.
- CI green on the final commit.
