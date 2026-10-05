# Implementation Plan: Cara Kerja Timeline Redesign

## Overview
Replace the 4-card grid in `HowItWorks` with a vertical timeline: left rail line, per-step dots, title + description + image per step, and a scroll-driven progress fill. Subtle foreground-on-green styling.

## Architecture Decisions
- Keep `steps` data and section copy/id/nav unchanged.
- Progress via section ref + scroll listener (rAF-throttled, passive).
- Each dot activates once the fill passes its center.

## Task List

### Phase 1
- [ ] Task 1: Timeline markup in HowItWorks.tsx
- [ ] Task 2: Scroll progress fill + dot states
- [ ] Task 3: Keep step images in timeline cards

### Checkpoint
- [ ] tsc --noEmit, next lint, next build pass; manual scroll check

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Scroll listener perf | Low | rAF throttle, passive listener |
| Mobile overflow | Med | min-w-0 content, small rail |

## Open Questions
- None
