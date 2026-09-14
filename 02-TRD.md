# NyaySetu — Technical Requirements Document

See `00-MASTER.md` for locked decisions and `01-PRD.md` for feature scope before reading this.

## Architecture

Upload → Parse & extract (OCR + structured clause/risk tagging) → two parallel modules, Risk & Compare and Q&A & Checklist → Export.

Accessibility (voice I/O, language toggle, low-bandwidth mode) and security (encryption, ephemeral storage, rate limiting) are not pipeline stages — they're constraints applied at every stage.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind | Fast to ship, strong accessibility primitives |
| UI foundation | shadcn/ui + Radix primitives, fully re-themed | One library, not several — see `00-MASTER.md` decision 1 |
| Animation | Framer Motion (standard), GSAP (one flagship moment only) | See `00-MASTER.md` decision 4 |
| LLM primary | Gemini API, AI Studio free tier | Google-run event; structured JSON output keeps extraction auditable |
| LLM fallback | OpenRouter | Behind the same provider interface as Gemini — see below |
| OCR | Tesseract (local) or Document AI | Tesseract if avoiding paid APIs; confirm quota/budget before committing to Document AI |
| Session/vector store | In-memory, session-scoped | One document per session — a persistent vector DB is overengineering at this scale |
| Voice | Web Speech API | Free, client-side, no extra infra |
| i18n | Static JSON dictionaries + Gemini-assisted translation for generated content | Simple for UI strings; generated summaries translate per request |
| Testing | Vitest | Fast, standard |
| CI | GitHub Actions | Free, visible code-quality signal |
| Deploy | Vercel (or equivalent) | Matches Next.js, gives a live link with minimal config |

## LLM provider interface

Define one interface, e.g. `LLMProvider { extractClauses(doc), answerQuestion(doc, question), ... }`, with a `GeminiProvider` implementation and an `OpenRouterProvider` implementation behind it. The app calls the interface, never a specific SDK directly. On a Gemini failure, fall back to OpenRouter and log which provider served the request (for the demo, and for the "services utilized" writeup). This is the clean way to satisfy the primary/fallback requirement without duplicating logic — a naive if/else scattered through the codebase is a code-quality risk, not a feature.

## Data schemas (illustrative — refine during build)

```ts
type Clause = {
  id: string;
  page: number;
  sourceText: string;
  type: string;               // e.g. "security_deposit", "termination"
  plainSummary: string;
  riskLevel: "info" | "caution" | "high-risk";
  rationale: string;
};

type ChecklistItem = {
  id: string;
  text: string;
  kind: "action" | "lawyer_question";
  sourceClauseId: string | null;
};
```

Validate every LLM output against these shapes (zod) before it touches app state.

## Frontend code-quality standards

This is the section that directly addresses the "too many components, code quality will suffer in the frontend" risk. Follow it literally, don't improvise a different structure mid-build.

- **Layering:**
  - `ui/` — pure, stateless design-system primitives wrapping shadcn (Button, Card, Badge). No business logic, ever.
  - `components/` — composed, still mostly presentational, built from `ui/` primitives.
  - `features/` — one folder per feature (`features/document-analysis/`, `features/qa-chat/`, ...) containing that feature's hooks, logic, and feature-specific components.
  - `app/` — routes/pages, composition only.
- **No business logic inside JSX.** Extract into hooks (`useClauseExtraction`, `useDocumentUpload`) or plain service functions.
- **No `any`.** Explicit prop types; discriminated unions for variant props (e.g., risk level driving card styling).
- **Styling from tokens only.** A single `tokens.ts` (or CSS variables file) holds the palette and type scale from the UI/UX brief — never a hardcoded hex value inside a component.
- **One animation-variants file.** Framer Motion variants defined once (`motion-variants.ts`) and reused, not redefined ad hoc in every component.
- **Lint:** `eslint-plugin-jsx-a11y`, `eslint-plugin-react-hooks`, `@typescript-eslint` with type-checked rules enabled — non-negotiable given accessibility is a scored axis.
- **Testing:** every `features/*` module gets at least one colocated test for its non-LLM logic.
- **CI gate:** lint + typecheck + test must pass before merge, every time — not just before submission.

## Security requirements

- Session-scoped storage, auto-delete on TTL, an explicit "delete my data" control.
- No document content in logs or analytics.
- HTTPS; encryption at rest for anything persisted.
- File type/size validation on upload.
- Rate limiting on upload and LLM endpoints.
- Secrets in environment variables only; commit `.env.example`, never `.env`.
- Dependency audit (`npm audit` / Dependabot) before submission.

## Efficiency requirements

- Stream LLM responses.
- Cache parsed document + embeddings per session — don't re-parse on every query.
- One structured extraction call per document, not one per clause.
- Code-split heavy components (PDF viewer, the one GSAP moment).
- Backoff-based retry on LLM calls, not naive immediate retry.

## Deployment

- Deploy target: Vercel (or equivalent that fits the Next.js stack).
- Environment variables: `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, plus any OCR service key.
- Confirm before deploying: any per-round API-cost or stack constraint from the organizers (flagged as open in `00-MASTER.md`).
