# NyaySetu — Master Document
### Google Prompt Wars, exclusive round — "AI for Legal Assistance & Access"

This is the top-level guide. Read this first, then PRD → TRD → UI/UX Brief → Prompt Pack, in that order. Every other document assumes the decisions made here.

## Document set

| File | Answers |
|---|---|
| `01-PRD.md` | What are we building, for whom, and how do we know it's done |
| `02-TRD.md` | How is it built — architecture, stack, schemas, code-quality rules, security, deployment |
| `03-UIUX-BRIEF.md` | What does it look and feel like — and why that earns trust |
| `04-PROMPT-PACK.md` | Paste-ready prompts for Gemini Antigravity, in build order |

## Vision

Most entries in this theme will read as "chatbot for contracts." NyaySetu is judged on the same five axes as everyone else — but it wins problem-statement alignment by targeting people who sign documents they don't understand and have no lawyer on call, and it wins trust (which isn't a named axis but decides whether anyone would actually use it) by looking like a serious legal product instead of a generic AI demo.

## What "excellent" means, per scoring axis

- **Code quality:** one consistent architecture across frontend and backend, typed everywhere, CI green on every commit, no library sprawl beyond what's declared in the TRD, tests on the logic that doesn't depend on the LLM.
- **Efficiency:** streamed responses, cached session state, one structured extraction call instead of one per clause, a lean bundle (heavy animation is scoped to one moment, not everywhere).
- **Accessibility:** WCAG 2.1 AA, voice in/out, a regional-language toggle, a low-bandwidth mode. The risk to watch: a heavily styled, animated UI can quietly break screen-reader semantics if built carelessly — the UI/UX brief and TRD both call this out.
- **Security:** session-scoped storage with auto-delete, no document content in logs, rate limiting, a dependency audit before submission.
- **Problem-statement alignment:** every use case in the brief maps to a shipped feature, reproduced as a table in the README.
- **Trust (the unscored axis that decides adoption):** doesn't look templated or AI-generated. Consistent palette, typography, and motion system throughout. See the UI/UX brief.

## Key decisions (locked — don't relitigate mid-build)

1. **One UI foundation, not several.** shadcn/ui + Radix primitives + Tailwind, fully re-themed with custom tokens. Mixing multiple component libraries is exactly the kind of stack sprawl that costs code-quality points — pick one and commit.
2. **No user accounts, no persistent database.** Session-scoped and ephemeral by design. This is simultaneously a security win, a scope-discipline win, and a code-quality win (fewer moving parts to get wrong).
3. **LLM provider: Gemini (AI Studio free tier) primary, OpenRouter fallback.** Implemented behind a single provider-agnostic interface, not two parallel code paths. Both are declared in the README's "services utilized" list per the submission requirements below.
4. **Animation: Framer Motion for all standard UI motion; GSAP reserved for exactly one flagship moment** (the document-intake/scan animation on upload). Using GSAP everywhere would fight the efficiency axis for no real benefit.

## Submission requirements (confirmed)

- No pitch deck for this round.
- A written submission covering: every service/API used, where in the product each is used, and a description of the changes/updates made in the deployed version.
- Public repo link.
- Deployed live link.
- Project video is submitted separately — out of scope for now, revisit once the build is stable.

Keep a running "services utilized" list from day one (Gemini API, OpenRouter, OCR engine, hosting/deploy target, any other API) so the written submission is a five-minute task at the end, not a scramble.

## Open items

- Baseline "fair practice" reference content for compare mode needs real sourcing (state tenancy norms, standard labor terms) — not LLM invention. Research task, not a build task.
- Any explicit API-cost or stack constraints for this specific round haven't been confirmed with organizers — worth a quick check before deployment.
