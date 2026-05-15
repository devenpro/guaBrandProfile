# Category: setup

**Charter.** The autopilot first-run experience: a takeover full-screen UI that collects the brand's URL, name, growth phase, brand types, and AI provider/model, then runs AI stages sequentially with per-row recover/skip. On completion, it auto-accepts every generated key into `W.acceptedSections` and hands off to the regular app (the three-pane shell once Phase 4 ships; the legacy review screen during Phase 3).

**Belongs here.**

- `bpw-setup-stages.js` — `STAGE_REGISTRY` (one entry per autopilot stage), growth-phase × brand-type gate matrix, `stagesFor(level, types)`, `findStage(id)`, `diffStages(fromLevel, toLevel, types)` (delta-mode for phase upgrades).
- `bpw-setup-orchestrator.js` — sequential runner with pause/resume/recover/skip. **Sole owner of `W.isAIProcessing` while the autopilot is open.** On finish, auto-accepts every generated flat key through `window._bpwAcceptSection` (legacy assembly bridge).
- `bpw-setup.js` — UI shell + form + stage rail. Boots on first-run when `W.acceptedSections` is empty. Body class `bpw-setup-open` hides the legacy `#bpwApp` via CSS while open.
- `bpw-setup.css` — takeover styling, uses `--bpw-*` tokens from `src/styles/tokens.css`.

**Does not belong here.**

- LLM provider plumbing → `src/ai/`.
- Per-section editing UI → `src/ui/` (Phase 4).
- Drupal field-sync glue → `src/legacy/` until extracted in a later refactor stage.

**Public exports.**

- `window._bpwSetupStages` — `{ STAGE_REGISTRY, stagesFor, findStage, diffStages }`.
- `window._bpwSetupOrchestrator` — `{ start, pause, resume, recoverCurrent, skipCurrent, state }`.
- `window._bpwSetup` — `{ openIfFirstRun, openDelta, close, render }`.

**Invariants.**

1. The orchestrator is the *only* owner of `W.isAIProcessing` while setup is open. AI actions invoked from setup never touch the flag themselves.
2. Stage actions return `{ success, data, error }`. The orchestrator writes `data` flat keys into `W.generatedSections` and calls `setSectionState(k, 'generated')` for each.
3. On `finishSetup`, every generated flat key is auto-accepted via `window._bpwAcceptSection`. The legacy assembly override (`bpw-part2b.js:199`) transforms flat keys → nested `W.acceptedSections`.
4. Growth-phase downgrade does **not** trigger autopilot — `W.brandLevel` is updated and the UI hides non-applicable sections via `view.minLevel`.
5. The setup UI never modifies anything outside `W.setup`, `W.seedContext`, `W.brandLevel`, `W.brandTypes`, `W.aiProvider`, `W.aiModel`, `W.generatedSections`, and `W.acceptedSections.identity.name`.
