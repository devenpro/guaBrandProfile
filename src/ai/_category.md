# Category: ai

**Charter.** All LLM-facing code: provider abstraction, the LLM dispatcher, brand-context assembly, prompt assembly per stage, structured-output parsing, AI-driven actions (setup stages + post-setup inline actions). Depends on `core` and `utils`; nothing in those depends back on `ai`.

**Belongs here.**

- `providers/registry.js` — `window._bpwAIProviders` namespace bootstrap.
- `providers/<id>.js` — one file per provider (gemini, claude, openai, grok, groq, openrouter, nvidia, huggingface). Each self-registers a `{ buildRequest, parseResponse }` adapter.
- `llm-service.js` — provider-agnostic `LLMService` (init, isConfigured, getActiveProviders, getActiveModels, callAI, renderPicker, renderProviderSelect, renderModelSelect). Dispatches `callAI` via the registry. **Never touches `W.isAIProcessing`** — that flag is owned by the batch orchestrator.
- `brand-service.js` — reads `W.acceptedSections` and builds system prompts that inject already-generated brand context into downstream calls.
- `_helpers.js` (Phase 2.2) — `parseJSON`, `extractBraceBlock`, `brandSnippet`, `callAIWithRetry`, `aiActionLoading`. Shared utilities for actions.
- `actions/<group>.js` (Phase 2.2/2.3) — self-contained AI actions. Each uses the `_resolveHelpers()` lazy-bind pattern (deps read at call time, not module load) and registers onto `window._bpwAIActions[<group>]`.
- `assembly-controller.js` (Phase 2.3) — ports `src/legacy/bpw-part2b.js`. Owns the `ASSEMBLY_MAP` (150+ flat→nested key mappings) and the `acceptSection` override. Drupal export field shapes depend on it; the map must survive verbatim.

**Does not belong here.**

- UI components that are not AI-specific → `src/ui/` (Phase 4).
- Drupal form glue → `src/legacy/` until extracted in a later refactor stage.
- State or routing → `src/core/`.
- Orchestration of multiple AI stages → `src/setup/` (Phase 3).

**Public exports.**

- `window.LLMService` — provider-agnostic chat/completion API (replaces legacy `window._bpwLLMService` once legacy is deleted).
- `window.BrandService` — brand context lookup + system-prompt builder.
- `window._bpwAIProviders[id]` — registered provider adapters.
- `window._bpwAIActions[group][fn]` — AI action functions (Phase 2.2+).
- `window._bpwAIHelpers` — shared helpers (Phase 2.2+).

**Invariants.**

1. `LLMService.callAI` never reads or writes `W.isAIProcessing`. Batch lifecycle is the orchestrator's responsibility.
2. Every public action function calls `_resolveHelpers()` at its top — never read globals at module load.
3. `ASSEMBLY_MAP` and the `acceptSection` override stay verbatim through the rebuild. Drupal export fields depend on them.
