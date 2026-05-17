# Category: ui

**Charter.** The post-setup app shell. v3 collapsed the legacy 3-pane layout into a single full-width page per section. Layout is sidebar (210px) + one page rendered by the active view's `renderDetail(W)`. Inline AI actions (Find more competitors, Generate more personas, Run SEO audit) live inside the section views and call into `window._bpwAIActions`.

**Belongs here.**

- `app-shell.js` — top-level `renderIfReady` + `render` + `setActiveSection` + `setActiveItem`. Owns `W.ui` state (section, itemId, activityOpen).
- `sidebar.js` — sidebar nav. `SECTIONS` list with `minLevel` and `brandTypes` gates so sections hide on downgrade without destroying data.
- `topbar.js` — title + breadcrumb + activity-drawer toggle.
- `activity-drawer.js` — slide-out right-side drawer reading `W.activityLog` or the Drupal `field_activity_log` JSON.
- `refine-modal.js` — shared "improve with prompt" modal used by per-field sparkle menus.
- `field-menu.js` — sparkle dropdown popover (Improve / Regenerate / Copy) rendered per field card.
- `_export-sync.js` — thin wrapper around legacy `syncAllExportFields`.
- `bpw-app.css` — page-style + sidebar + drawer + cards. Uses `--bpw-*` tokens.
- `views/<section>.js` — one file per sidebar section. Each exports `{ id, title, minLevel, listMode, renderList, renderDetail, inlineActions }`. `listMode` is always `'none'` (page-style); `renderList` returns empty string.

**Does not belong here.**

- LLM provider plumbing → `src/ai/`.
- Autopilot orchestration → `src/setup/`.
- Drupal field-sync internals → `src/legacy/` until extracted.

**Public exports.**

- `window._bpwAppShell` — `{ renderIfReady, render, setActiveSection, setActiveItem, state }`.
- `window._bpwSidebar`, `_bpwTopbar`, `_bpwActivityDrawer` — each has a `render(W)` function.
- `window._bpwUIViews[<section>]` — per-view definitions.
- `window._bpwFieldMenu` — `{ openMenu, close }` for the sparkle popover.
- `window._bpwRefineModal` — `{ openField, openSection }`.
- `window._bpwExportSync` — `{ syncAll, syncOne }`.

**Invariants.**

1. Views never call `LLMService.callAI` directly. They invoke `window._bpwAIActions[group][fn]` and handle the callback.
2. State writes funnel through `window._bpwAcceptSection` so the legacy assembly bridge fires and `syncAllExportFields` updates the 7 Drupal fields.
3. `W.ui` is purely UI state — sidebar selection, item selection, drawer open. Persisting it is fine (lives in `field_json_data`); restoring it on reload is a follow-up.
4. Body class `bpw-app-shell-active` hides legacy `#bpwApp` via CSS while the new shell is mounted.
