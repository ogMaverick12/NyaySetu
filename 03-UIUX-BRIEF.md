# NyaySetu — UI/UX Brief

See `00-MASTER.md` and `02-TRD.md` first. This brief exists because the feature set can be perfect and the product will still fail if it looks like a generic AI-generated template — for a legal-trust product, the visual layer is not decoration, it's the credibility mechanism.

## Design principles

1. **Calm authority, not startup energy.** No purple-to-blue gradient blobs, no glassmorphism-everywhere, no bouncy playful motion. This is closer to "a well-run law office's client portal" than "a Series A SaaS landing page."
2. **The document is the hero, not the chrome.** Every screen should feel like it's in service of the user's actual document — panels, cards, and typography should evoke paper and formal correspondence, not dashboards.
3. **Motion is purposeful, not decorative.** Every animation should communicate a state change (document parsed, clause confirmed, risk flagged) — never motion for its own sake.
4. **Accessibility and aesthetic are the same requirement, not a tradeoff.** A beautifully animated interface that breaks screen-reader semantics or ignores `prefers-reduced-motion` fails both the accessibility score and the trust goal.

## Visual language

**Palette** — a "law office" palette, not a "tech SaaS" palette:
- Ink navy / charcoal (`#1B2430`-ish) — primary text, headers, primary UI chrome
- Parchment / ivory background (`#F7F3EA`-ish) — main background, evokes paper without being literal
- Brass / gold accent (`#B08D57`-ish) — used sparingly, for emphasis and interactive accents
- Risk system: sage/forest green for confirmed low-risk (`#3F6C51`-ish), amber for caution (`#C08A2E`-ish), muted burgundy for high-risk (`#8C2F39`-ish) — clear but not alarming; no saturated red siren colors

**Typography:**
- Headlines: a high-contrast, characterful serif — **Fraunces** (Google Fonts, free) reads as editorial/legal without tipping into cliché Times New Roman.
- Body/UI: a clean, legible sans that isn't the default AI-app choice — **IBM Plex Sans** or **General Sans** rather than plain Inter.
- Reference numbers / clause IDs: a monospace touch (**IBM Plex Mono**) for citation-style anchors — reinforces "official document" register.

**What to explicitly avoid:** the default shadcn theme left unstyled (zinc grays, default blue primary), Inter as the only font, glassmorphism/heavy blur, gradient-blob hero backgrounds, stock "scales of justice" clipart, generic robot/AI iconography, emoji in UI copy, bubbly rounded chat bubbles for the Q&A panel, autoplaying looping decorative animation.

## Component library strategy

Single foundation per `00-MASTER.md`: **shadcn/ui + Radix primitives**, fully re-themed with the tokens above — not the out-of-the-box look. Radix gives strong accessibility semantics for free (focus management, keyboard nav, ARIA); the re-theming is what keeps it from looking like every other shadcn app.

**Framer Motion** for all standard interaction and page-transition motion. **GSAP reserved for exactly one flagship moment** — the document intake/scan animation on upload — to keep the bundle lean and avoid using a heavier tool everywhere out of enthusiasm rather than need.

## Key screens

1. **Upload / intake.** Framed like a case intake desk rather than a generic dropzone — a bordered panel with a subtle paper-grain texture (restrained, not skeuomorphic). On drop, the one GSAP moment: the document visually "settles into place" as if placed on a desk, then a scan-line effect during parsing.
2. **Document analysis.** Split view: original document on the left (scrollable, page-anchored), clause panel on the right — cards styled like margin notes on a legal document, with a colored left-border tag for risk level rather than a loud badge. This mirrors how lawyers actually annotate documents, which is part of why it reads as credible rather than "AI dashboard."
3. **Compare mode.** A tracked-changes / redline visual metaphor — the convention legal documents already use for revisions — rather than an invented diff UI. Familiarity here is doing real trust work.
4. **Q&A panel.** A formal consultation transcript register ("You asked" / "The document says"), with citations as small reference chips linking back to the source clause — not a casual rounded chat-bubble UI.
5. **Checklist / export.** Styled like an official letter or memo: serif headline, clean numbered list, the "Questions for your lawyer" section set apart in a bordered card.

## Motion specification

- Page/element transitions: 150–250ms, ease-out, subtle fade/slide — nothing springy or bouncy.
- Clause-card reveal: gentle upward fade with a short stagger across cards.
- Risk-flag appearance: a brief color settle, not a blink or loop.
- Respect `prefers-reduced-motion` everywhere — disable non-essential motion, keep functional state changes instant.
- All motion definitions live in one `motion-variants.ts` (per `02-TRD.md`) — no ad hoc transition objects scattered through components.

## Accessibility checkpoints specific to this visual system

- Verify color contrast for the parchment/ink palette meets WCAG AA (ivory backgrounds with navy text usually pass easily; check the brass accent against parchment specifically, as gold-on-cream can run low-contrast).
- Confirm the risk-level color system also carries a non-color signal (icon or label), not color alone.
- Test the redline/tracked-changes compare view with a screen reader — diff UIs are easy to get visually right and semantically wrong.
- Run axe-core after the animation pass, not just after the static build — motion and dynamically injected content are common places accessibility regressions sneak in.
