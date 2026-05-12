# Refactor Plan — Legacy → Modular

This document describes how the four monolithic legacy files in `src/legacy/` migrate into the feature-modular layout advertised in [`README.md`](../README.md) (`core/`, `ui/`, `editing/`, `ai/`, `settings/`, `activity/`, `utils/`, `styles/`). It is the plan referenced by `README.md`'s v0.1.0 note.

The migration is intentionally incremental: each stage lands as its own commit, the bundle is re-built and smoke-tested, and `src/legacy/` is only deleted at the end. No feature work happens during the refactor.

---

## 1. Goals & non-goals

**Goals**

- Split the legacy files into feature-aligned modules without changing runtime behavior, module load order, or the public `dist/bpw.min.{js,css}` surface.
- Preserve the cross-file hand-off currently expressed via `window._bpw*` symbols.
- Keep coding conventions documented in [`PROJECT.md`](PROJECT.md#coding-conventions-must-follow) intact (logging prefixes, CSS prefix, `--bpw-*` tokens, no `display:none` on the Drupal form, etc.).

**Non-goals**

- Feature additions, behavior changes, or UX polish.
- Dependency upgrades or build-tool swaps (esbuild stays).
- CSS class rename or design-system overhaul.
- API redesign of the LLM service or activity log.

---

## 2. Current state inventory

Line counts and section indices below come from the legacy files as-is. Run `grep -nE "SECTION" src/legacy/*.js` to reproduce.

| File | Lines | Sections | Purpose |
|---|---|---|---|
| `src/legacy/bpw-app.js` | ~3,480 | 25 | Boot, state, navigation, 12 screens, LLM service, AI pipeline, event wiring, exports |
| `src/legacy/bpw-part2a.js` | ~1,117 | 11 | Prompt templates, step runners, URL scraping, inline editing, redo, voice preview, v2→v1 migration bridge |
| `src/legacy/bpw-part2b.js` | ~774 | 12 | Assembly engine, discovery question generator, basics collector, navigation guards, completeness engine, session protection, toast, post-wizard actions |
| `src/legacy/bpw-part2c.js` | ~365 | 7 | Activity logging instrumentation, activity log panel, settings panel, boot |
| `src/legacy/bpw-app.css` | ~1,487 | 24 | Design tokens, reset, components, layout, screens, responsive |

Build entry: `src/index.js` imports the four JS files in their historical order; `src/index.css` imports `bpw-app.css`. `scripts/build.mjs` bundles both with esbuild (`format: 'iife'`, minified) into `dist/bpw.min.{js,css}`.

---

## 3. Target module map

Every numbered section in every legacy file has a destination. Sections within a single legacy file may split into multiple target modules; sections from different legacy files may consolidate into a single target module.

### JavaScript

| Legacy location | Destination |
|---|---|
| `bpw-app.js` §1 CONSTANTS, §2 STATE | `src/core/state.js` |
| `bpw-app.js` §3 INITIALIZATION | `src/core/boot.js` |
| `bpw-app.js` §4 UTILITIES | `src/utils/dom.js`, `src/utils/helpers.js` |
| `bpw-app.js` §5 DEFAULT DATA & MODULES | `src/core/schema.js` |
| `bpw-app.js` §6 TYPE DETECTION, §7 STEP BUILDER, §8 NAVIGATION | `src/core/navigation.js` |
| `bpw-app.js` §9 APP SHELL | `src/ui/shell.js` |
| `bpw-app.js` §10 AUTO-SAVE & RESUME | `src/core/autosave.js` |
| `bpw-app.js` §10B EXPORT FIELD POPULATION | `src/core/drupal-sync.js` |
| `bpw-app.js` §11–22 SCREEN — * | `src/ui/renderers/<screen>.js` (one file per screen: welcome, type-detection, basics, assets-import, ai-discovery, market-research, identity, voice, audience, offerings, content-channels, review) |
| `bpw-app.js` §23 LLM SERVICE | `src/ai/llm-service.js` |
| `bpw-app.js` §24 AI PIPELINE | `src/ai/pipeline.js` |
| `bpw-app.js` §25 EVENT HANDLERS & EXPORTS | `src/core/events.js` |
| `bpw-part2a.js` §2 PROMPT TEMPLATES | `src/ai/prompts.js` |
| `bpw-part2a.js` §3 STEP RUNNERS | `src/ai/step-runners.js` |
| `bpw-part2a.js` §4 URL SCRAPING | `src/ai/scrapers.js` |
| `bpw-part2a.js` §5 INLINE SECTION EDITING | `src/editing/inline-editor.js` |
| `bpw-part2a.js` §6 REDO WITH GUIDANCE, §7 ACCEPT ALL / REDO ALL | `src/ai/redo.js` |
| `bpw-part2a.js` §8 VOICE PREVIEW GENERATOR | `src/ai/voice-preview.js` |
| `bpw-part2a.js` §9 V2→V1 MIGRATION BRIDGE | `src/core/migration.js` |
| `bpw-part2b.js` §2 SECTION ASSEMBLY ENGINE | `src/editing/assembly.js` |
| `bpw-part2b.js` §3 AI DISCOVERY QUESTION GENERATOR | `src/ai/discovery.js` |
| `bpw-part2b.js` §4 BASICS FORM COLLECTOR | `src/editing/basics.js` |
| `bpw-part2b.js` §6 NAVIGATION GUARDS | `src/core/guards.js` |
| `bpw-part2b.js` §7 ENHANCED COMPLETENESS ENGINE | `src/core/completeness.js` |
| `bpw-part2b.js` §8 SESSION PROTECTION & KEYBOARD SHORTCUTS | `src/ui/keyboard.js` |
| `bpw-part2b.js` §9 ENHANCED TOAST | `src/ui/toast.js` |
| `bpw-part2b.js` §10 POST-WIZARD ACTIONS | `src/ui/post-wizard.js` |
| `bpw-part2c.js` §2 ACTIVITY LOGGING | `src/activity/log.js` |
| `bpw-part2c.js` §3 ACTIVITY LOG PANEL UI | `src/activity/panel.js` |
| `bpw-part2c.js` §4 SETTINGS PANEL UI | `src/settings/panel.js` |

Sections not listed (init/imports, event-wiring/exports for each legacy file) are absorbed into the equivalent stage's `index.js` aggregator or into the new top-level `src/index.js`.

### CSS

`src/legacy/bpw-app.css` already documents its own 24 sections in its file header. They split as follows:

| Legacy CSS section | Destination |
|---|---|
| S1 Variables | `src/styles/tokens.css` |
| S2 Reset & Base | `src/styles/reset.css` |
| S3 Header, S4 Progress Bar, S5 Content & Step Card | `src/styles/layout.css` |
| S6 Step Header, S7 Buttons, S8 Form Elements, S9 Section Labels, S21 Toast, S22 Skeleton, S23 Utilities | `src/styles/components.css` |
| S10–S20 (welcome, level cards, detection, brand-type, AI section, alternative picker, question/radio, scrape/import, persona/offering/pillar/competitor, review, voice/dos-donts/vocabulary) | `src/styles/screens.css` |
| S24 Responsive | `src/styles/responsive.css` |

---

## 4. Cross-module contract

The legacy files communicate through a small set of `window._bpw*` symbols. The producer/consumer map below dictates which symbols need explicit ES exports and which can be retired in favor of direct imports.

**Producers**

- `bpw-app.js` exports state, navigation, render, LLM service, AI helpers, autosave, util helpers, activity logging, and `_bpwConstants`. See `bpw-app.js:3703-3742`.
- `bpw-part2a.js` exports `window._bpwPart2A`. See `bpw-part2a.js:1300`.
- `bpw-part2b.js` exports `window._bpwPart2B` and overrides `window._bpwToast`. See `bpw-part2b.js:732`, `bpw-part2b.js:768`.
- `bpw-part2c.js` exports `window._bpwPart2C`.

**The override**

- `window._bpwAcceptSectionOverride` is set by `bpw-part2b.js` (line 199) and called by Part 1's local `acceptSection()`. Part 2C (line 71) wraps it. This is the assembly-override path documented in [`PROJECT.md`](PROJECT.md#critical-rules) rule 5. It survives the refactor as a named export from `src/editing/assembly.js` consumed by `src/core/events.js`.

**Migration rule**

- Keep the global `W` state object in `src/core/state.js` and re-export it as `default` so existing call sites (`W.brandTypes`, `W.acceptedSections`, etc.) keep working with minimal churn.
- Convert every other `window._bpw*` into a named ES export from its new home and update consumers to `import { … }` it. The `window._bpw*` aliases stay assigned at the bundle boundary (in `src/index.js`) for one stage as a safety net, then are deleted at Stage 7.

---

## 5. Phased execution

Each stage is one commit. The gate at the end of every stage: `npm run build` succeeds, every changed JS file passes `node -c`, the bundle loads on a Drupal edit page, and the smoke checklist in §6 passes.

- **Stage 0 — Land this plan.** No code change. Confirm `npm run build` clean from a fresh clone.
- **Stage 1 — Leaf utilities.** Extract `src/utils/dom.js`, `src/utils/helpers.js`, `src/styles/tokens.css`, `src/styles/reset.css`, `src/styles/responsive.css`. No cross-module dependencies, so risk is minimal.
- **Stage 2 — `src/core/`.** Extract state, schema, navigation, autosave, drupal-sync, guards, completeness, migration, boot, events. This is the largest single stage; split into 2–3 commits if review burden warrants.
- **Stage 3 — `src/ai/`.** Extract llm-service, prompts, step-runners, pipeline, scrapers, redo, voice-preview, discovery.
- **Stage 4 — `src/editing/`.** Extract inline-editor, assembly, basics. The `_bpwAcceptSectionOverride` wiring moves to `src/editing/assembly.js` here.
- **Stage 5 — `src/ui/`.** Extract shell, toast, keyboard, post-wizard, and one renderer per screen under `src/ui/renderers/`.
- **Stage 6 — `src/activity/` and `src/settings/`.** Extract activity log + panel and settings panel.
- **Stage 7 — Demolition.** Delete `src/legacy/`, remove the residual `window._bpw*` aliases from `src/index.js`, update `README.md:62`, bump version.

`src/legacy/` is kept in place until Stage 7 — that way the partial refactor can co-exist with un-extracted modules through the import in `src/index.js`.

---

## 6. Verification strategy

**Per-stage build parity**

- Run `npm run build` and confirm no errors and no new warnings.
- `node -c` every JS file touched in the stage.
- Diff `dist/bpw.min.js` against the previous stage's output via sourcemap section sizes (not byte-for-byte — minifier reorders).

**Per-stage runtime smoke checklist** (drawn from [`BPW-QUICK-REFERENCE.md`](BPW-QUICK-REFERENCE.md))

1. Page loads on `/node/{id}/edit` for the `brand_profile` content type; wizard mounts.
2. Brand-type detection screen accepts answers and unlocks the next step.
3. AI discovery screen triggers an LLM call against the configured provider.
4. Inline "Write my own" editor opens and saves to the section state.
5. Autosave fires on field change; `field_json_data` updates.
6. All 7 export fields populate on save (Core, Video, Content, SEO, Social, Meta, Activity).
7. Activity log panel renders entries; settings panel opens.
8. Review screen reaches the "complete" state and the Drupal submit button still works.

**Rollback**

- Each stage is its own commit. Revert is `git revert <stage-commit>`; the previous stage's bundle is unaffected.

---

## 7. Conventions to preserve

Pulled from [`PROJECT.md`](PROJECT.md#coding-conventions-must-follow):

- One ES module per file replaces the legacy "single IIFE per file" rule. The outer IIFE wrapper is dropped because esbuild's `format: 'iife'` already wraps the whole `dist/bpw.min.js`.
- Section headers (`// ============ SECTION N: NAME ============`) are retained inside each new module file when sections exceed ~100 lines, to keep navigation familiar.
- Console logging prefixes `[BPW]`, `[BPW-2A]`, `[BPW-2B]` are preserved at the consumers that already use them; new modules adopt `[BPW-<area>]` (e.g. `[BPW-ai]`, `[BPW-ui]`).
- CSS prefix `bpw-` and the `--bpw-*` token palette stay verbatim.
- No `display:none` on the Drupal form — offscreen positioning only.
- Responsive breakpoints unchanged: 1200px, 992px, 768px, 480px.

---

## 8. Open questions

These should be resolved before Stage 1 begins.

1. **`W` namespace.** Does `W` stay as a shared object re-exported from `src/core/state.js`, or do we move to named imports for every piece of state? *Recommendation:* keep `W` for the duration of the refactor to minimize diff size; revisit after Stage 7 as a follow-up.
2. **Incremental vs. final legacy deletion.** Delete each `src/legacy/` file as soon as its contents are fully extracted, or leave the legacy tree intact until Stage 7? *Recommendation:* Stage 7 only — the `src/index.js` import keeps un-extracted modules loading during the migration and shrinks per-stage diffs.
3. **Per-screen renderer split.** Should the 12 screens each get their own renderer file or be grouped (e.g., one file for "early funnel" screens, one for "AI sections")? *Recommendation:* one file per screen; total LOC per file stays under ~300, and per-screen ownership reads naturally.

---

## 9. References

- [`README.md`](../README.md) — high-level project layout.
- [`PROJECT.md`](PROJECT.md) — system prompt, coding conventions, critical rules.
- [`BPW-ARCHITECTURE.md`](BPW-ARCHITECTURE.md) — architectural intent.
- [`BPW-DEVELOPMENT-GUIDE.md`](BPW-DEVELOPMENT-GUIDE.md) — workflow.
- [`BPW-QUICK-REFERENCE.md`](BPW-QUICK-REFERENCE.md) — smoke-test checklist source.
- [`scripts/build.mjs`](../scripts/build.mjs) — esbuild config; unchanged by this plan.
