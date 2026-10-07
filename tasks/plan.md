# Implementation Plan: Cara Kerja Horizontal Scroll Redesign

## Overview
Replace the vertical timeline in `HowItWorks` with a GSAP ScrollTrigger-scrubbed horizontal slider (pattern from howitworkss.tsx): vertical scrolling moves the slide sideways and each step (image, title, description) reveals in sequence. `howitworkss.tsx` is deleted after adaptation.

## Architecture Decisions
- Inline `useGSAP` helper (no @gsap/react dependency), copied from howitworkss.tsx.
- Keep `steps` data (4 ReBites steps, each with its own image), `id="cara-kerja"`, `data-nav="green"`.
- Sticky viewport section; horizontal flex slider; per-item reveal (line + dot + SplitText title/description).
- ReBites theme: `bg-primary`, `text-primary-foreground`, `caramel` accent instead of `#ff5f00`.
- Lenis sync: `ScrollTrigger.update` on `window.__lenis` scroll.
- Reduced motion: `gsap.set` fallbacks.
- Heading stays inside the slider as the first column (Product Storyline pattern).

## Task List

### Phase 1
- [x] Task 1: Rewrite HowItWorks.tsx with GSAP sticky horizontal slider
- [x] Task 2: Per-step reveal (line/dot/SplitText) + reduced-motion fallback + Lenis sync
- [x] Task 3: ReBites styling, delete howitworkss.tsx, update plan files

### Checkpoint
- [x] `npm run typecheck`, `npm run lint`, `npm run build` pass; manual scroll check

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| SplitText not registered | High | registerPlugin(ScrollTrigger, SplitText) |
| Lenis/ScrollTrigger desync | Med | lenis.on('scroll', ScrollTrigger.update) |
| Mobile overflow | Med | max-[600px]: breakpoints from howitworkss |

## Open Questions
- None
