# BPW Changelog

## v1.0.0 — 2026-03-24 (Current Release)

### Full Build Complete
- Guided wizard with 12 dynamic screens
- 3 brand levels (New ~10min, Growing ~20min, Deep ~35min)
- 4 brand types with auto-detection (Commercial, Local, Creator, Nonprofit)
- Dynamic step merging based on level + type
- v2.0 modular JSON schema

### AI Pipeline
- 7 prompt templates (market, identity, voice, audience, offerings, content, scrape)
- Sequential multi-prompt execution for merged steps
- Structured context builder (not raw JSON dump)
- Processing state with progress banner and button lockout
- Redo with context-aware guidance suggestion chips
- Voice preview generator (tweet, email, video, review, custom)

### Manual Input
- "Write my own" button on every pending AI section
- Type-aware inline editors (text, textarea, list, chips, values, JSON)
- Add offering manually with inline form
- Add persona manually with inline form
- Copy to clipboard on all generated/accepted sections

### Data Management
- Auto-save to textarea on navigation and section accept
- Save Progress button in header → full Drupal submit
- 7 export fields synced before every save (core, video, content, seo, social, meta, activity)
- Accept → Assembly → Module override pattern
- Fallback inline assembly for review page
- Seed data merge into identity module

### Review & Navigation
- Review page with color-coded status cards (green/amber/gray)
- Per-field completeness scoring with missing field guidance
- Review Edit → navigates to correct wizard step (level-aware mapping)
- Free navigation to review when basics + 1 AI step complete
- Progress dots show reachable/locked state
- Completed profiles auto-land on review with all steps marked done

### Platform Integration
- Old editor (bp-part1.js) blocked from v2 schema data
- LLM config read with 5 selectors, 4 parse strategies, 2s retry
- Form hidden offscreen (not display:none) for functional submit
- Drupal title field auto-filled from brand name
- Entity decode for Drupal-rendered content
- 3-trigger initialization (behaviors + setTimeout + window.load)

### UX Polish
- Processing banner with progress bar for multi-prompt steps
- Accept flash animation (green pulse)
- Keyboard shortcuts: Ctrl+S (save), Ctrl+Enter (next), Esc (cancel edit)
- Keyboard hint bar at bottom of every step
- Responsive: 1200px, 992px, 768px, 480px breakpoints

---

## Known Issues

- Export field machine names for `field_json_meta` and `field_activity_log` may need adjustment per site (currently using guessed selectors with wildcard fallback)
- Voice `sample_texts` assembly maps string to field that may expect array
- No character/token count on AI sections
- Discovery question skip only scrolls to next, doesn't mark skipped

---

## Previous Development Notes

Built in a single extended development session covering:
1. Architecture planning + wireframe
2. Full 4-file codebase build
3. Save/load/resume cycle bug fixes (C1-C5, S1-S10)
4. Old editor conflict resolution
5. AI generation pipeline fixes (Phases A-B)
6. Manual add/edit for all sections (Phase C)
7. Review page navigation + status (Phase D)
8. AI quality improvements (Phase E)
9. Polish — animations, clipboard, shortcuts (Phase F)
10. Assembly override fix + review completeness
11. Export field population system
12. Navigation unlock + review access
