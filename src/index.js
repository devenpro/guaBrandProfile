// Brand Profile Wizard — bundled entry point.
//
// Load order matters. The new `src/ai/` modules install themselves on
// `window.LLMService`, `window.BrandService`, and `window._bpwAIProviders`
// BEFORE legacy/bpw-app.js runs, so legacy's own `window._bpwLLMService`
// alias (set inside its IIFE) coexists alongside the new globals without
// clobbering them. New consumers (Phase 3+: setup orchestrator, inline
// AI actions) read `window.LLMService` directly; legacy code continues
// to read `window._bpwLLMService`.

// AI provider registry — must precede provider self-registrations.
import './ai/providers/registry.js';

// AI providers — each self-registers onto window._bpwAIProviders.
import './ai/providers/gemini.js';
import './ai/providers/claude.js';
import './ai/providers/openai.js';
import './ai/providers/grok.js';
import './ai/providers/groq.js';
import './ai/providers/openrouter.js';
import './ai/providers/nvidia.js';
import './ai/providers/huggingface.js';

// AI services — depend on providers being registered.
import './ai/llm-service.js';
import './ai/brand-service.js';
import './ai/_helpers.js';

// AI actions — each self-registers onto window._bpwAIActions.<group>.
// Use _resolveHelpers() lazy-bind pattern so module-load timing is
// not load-bearing.
import './ai/actions/scrape.js';
import './ai/actions/market.js';
import './ai/actions/identity.js';
import './ai/actions/voice.js';
import './ai/actions/audience.js';
import './ai/actions/offerings.js';
import './ai/actions/content.js';
import './ai/actions/seo.js';
// Inline-action aliases must follow their source actions.
import './ai/actions/competitors.js';
import './ai/actions/personas.js';

// Setup autopilot — depends on ai/* being registered.
import './setup/bpw-setup-stages.js';
import './setup/bpw-setup-orchestrator.js';
import './setup/bpw-setup.js';

// UI shell — three-pane post-setup app. Views populate
// window._bpwUIViews and must load BEFORE app-shell.js so the shell
// finds them on first render.
import './ui/_export-sync.js';
import './ui/editors/path-store.js';
import './ui/editors/fields.js';
import './ui/editors/prose.js';
import './ui/refine-modal.js';
import './ui/topbar.js';
import './ui/sidebar.js';
import './ui/section-list.js';
import './ui/detail-pane.js';
import './ui/activity-drawer.js';

// Per-section views.
import './ui/views/identity.js';
import './ui/views/voice.js';
import './ui/views/audience.js';
import './ui/views/offerings.js';
import './ui/views/market.js';
import './ui/views/content.js';
import './ui/views/seo.js';
import './ui/views/social.js';
import './ui/views/settings.js';

import './ui/app-shell.js';

// Legacy monolith — still defines its own LLMService closure and
// `window._bpwLLMService` alias used by bpw-part2a/2b/2c. Loaded last
// so legacy globals (_bpwAcceptSection, _bpwSetSectionState, _bpwIcon,
// _bpwToast, etc.) are available when the new modules' lazy resolvers
// run on first user interaction.
import './legacy/bpw-app.js';
import './legacy/bpw-part2a.js';
import './legacy/bpw-part2b.js';
import './legacy/bpw-part2c.js';
