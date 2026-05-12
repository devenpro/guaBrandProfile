# BPW Architecture Reference

## File Structure & Load Order

| File | Weight | Lines | Size | Role |
|------|:------:|:-----:|:----:|------|
| `bpw-app.css` | -100 | ~1,487 | 48 KB | Design system, all components |
| `bpw-app.js` | -100 | ~3,480 | 152 KB | Core engine, screens, LLM, save |
| `bpw-part2a.js` | -99 | ~1,117 | 49 KB | AI prompts, runners, scraping |
| `bpw-part2b.js` | -98 | ~774 | 27 KB | Assembly, guards, shortcuts |

---

## Global Resources Architecture

### AI Config Loading & Access

```
Page renders → Drupal outputs <div class="llm-config-data">{ JSON }</div>
  ↓
LLMService.init() tries 5 selectors:
  1. '.llm-brand-config-data'     (brand-specific override)
  2. '.llm-config-data'           (standard user config)
  3. '#llm-config-data'           (ID-based)
  4. '[data-llm-config]'          (data attribute)
  5. 'script[type="application/json"][data-llm-config]'  (script tag)
  ↓
For each found element, tries 4 parse strategies:
  1. jQuery .text() → JSON.parse     (handles basic entities)
  2. DOM .textContent → JSON.parse   (raw text)
  3. .innerHTML → _decodeEntities → JSON.parse  (double-encoded)
  4. Double _decodeEntities → JSON.parse         (triple-encoded)
  ↓
If all fail → setTimeout(_retryInit, 2000)  (handles late DOM load)
  ↓
_processConfig(raw):
  → Filter providers where active === true
  → Filter models where active === true
  → Build _providerMap: { id → { id, label, api_key, activeModels[] } }
  → Set W.aiProvider and W.aiModel from config defaults
```

**Hash Navigation Issue:** When page loads with URL hash (e.g., `#section`), some Drupal themes don't render certain blocks. The LLM config div may be absent on first load but present after refresh. The 2-second retry handles this. If building other apps with hash navigation, always include `_retryInit()`.

### Brand Context Access

```javascript
// During wizard (progressive build):
W.seedContext.name            // From basics form
W.seedContext.description     // From basics form
W.seedContext.website_url     // From basics form

// After AI generation + assembly:
W.acceptedSections.identity   // { name, mission, vision, values, ... }
W.acceptedSections.voice      // { primary_tone, personality_traits, dos, donts, ... }
W.acceptedSections.messaging  // { primary_message, supporting_messages, headlines }

// Full context for AI prompts:
buildAIContext()  // Returns { seed, imported, discovery, accepted, brand_level, brand_types }
```

### User Info Access

No direct user profile access. User's AI preferences stored in:
```javascript
W.data.ai_preferences = {
  default_provider: 'claude',
  default_model: 'claude-3.5-sonnet',
  custom_instructions: ''
};
```

---

## Init Chain

```
Page Load
  ↓
bpw-app.js IIFE:
  1. blockOldEditor() — wraps Drupal.behaviors.bpPart1.attach
     → Checks textarea for v2 schema → blocks old editor if v2 or empty
  2. bpwAttach() fires via 3 triggers:
     → Drupal.behaviors.bpw.attach()
     → setTimeout(bpwAttach, 50) — if DOM already ready
     → window.addEventListener('load') — last resort
  3. bpwAttach():
     → Body class check (brand-profile / brand_profile)
     → Textarea discovery (5 selectors)
     → Old editor cleanup (#bpApp removal)
     → shouldActivateWizard() — always true for schema_version '2.0'
  4. initWizard():
     → loadData() → resumeFromSave() if v2 schema
     → LLMService.init() — config from DOM
     → buildSteps() — dynamic step list
     → Step validation — fallback if saved step doesn't exist
     → Complete profile handling — land on review, mark all steps done
     → render() → STEP_RENDERERS[currentStepId]()
  5. Exports 35+ globals to window._bpw*

Part 2A: polls 100ms → imports globals → setupPart2AEvents()
Part 2B: polls 100ms → imports → overrideAcceptSection() → setupPart2BEvents()
```

---

## State Object (W)

```javascript
var W = {
  // Drupal refs
  $textarea, $form, $submitBtn,
  // Brand config
  brandLevel: '',           // 'new' | 'growing' | 'deep'
  brandTypes: [],           // ['commercial', 'creator', 'local', 'nonprofit']
  brandSubtypes: {},
  language: 'en',
  detection: { does: [], where: '', revenue: [] },
  // Navigation
  steps: [],                // Built by buildSteps()
  currentStepId: 'welcome',
  completedSteps: [],
  skippedSteps: [],
  // Data stores
  seedContext: {},           // Basics form fields
  importedAssets: {},        // Scraped website/social data
  discoveryAnswers: {},      // Q&A from discovery step
  generatedSections: {},     // AI output (flat keys)
  acceptedSections: {},      // Accepted: flat keys + assembled module objects
  sectionStates: {},         // Per-key: pending|loading|generated|accepted|manual
  data: {},                  // Raw parsed JSON from textarea
  // AI
  aiProvider: '', aiModel: '',
  isAIProcessing: false,
  _aiProgress: null,        // { total, current, stepKey, currentKey }
  // UI
  dirty: false, lastSaved: null,
  initialized: false, _initializing: false, isResuming: false,
  _socialRows: 1
};
```

---

## Data Flow: Accept → Assembly → Save → Export

```
User clicks "Accept" on voice_tone
  ↓
Part 1: acceptSection('voice_tone', data)
  → checks window._bpwAcceptSectionOverride (set by Part 2B)
  → delegates to override
  ↓
Part 2B override:
  → assembleModule('voice_tone', data)
    → ASSEMBLY_MAP: { module: 'voice', field: 'primary_tone' }
    → W.acceptedSections.voice.primary_tone = data
  → W.acceptedSections.voice_tone = data (flat key preserved)
  → W.generatedSections.voice_tone = data
  → W.sectionStates.voice_tone = 'accepted'
  → autoSave()
  ↓
syncToTextarea():
  → _mergeSeedIntoIdentity()
  → Builds payload { meta, identity, voice, ..., _wizard_state, ai_preferences }
  → W.$textarea.val(JSON.stringify(payload))
  ↓
drupalSave():
  → syncToTextarea()           → field_json_data
  → _setDrupalTitle()          → title field
  → syncAllExportFields():
    → buildV2ExportContext('core')    → field_brand_core
    → buildV2ExportContext('video')   → field_brand_video
    → buildV2ExportContext('content') → field_brand_content
    → buildV2ExportContext('seo')     → field_brand_seo
    → buildV2ExportContext('social')  → field_brand_social
    → buildMetaExport()              → field_json_meta
    → buildActivityLog()             → field_activity_log
  → $submitBtn.click()
```

---

## Dynamic Step Building

Steps built by `buildSteps()` based on `W.brandLevel` and `W.brandTypes`:

| Step ID | Level | Condition | Merged From |
|---------|-------|-----------|-------------|
| `welcome` | All | Always | — |
| `detect` | All | Always | — |
| `basics` | All | Always | — |
| `import` | All | Always | — |
| `discovery` | All | Always | — |
| `market` | Growing+ | commercial/local | — |
| `identity_voice` | New/Growing | Always | identity + voice |
| `identity` | Deep | Always | — |
| `voice` | Deep | Always | — |
| `audience_offerings` | New/Growing | Any type | audience + offerings |
| `audience` | Deep | Always | — |
| `offerings` | Deep | Any type | — |
| `content` | Growing+ creator; Deep commercial | — | — |
| `review` | All | Always (terminal) | — |

---

## AI Pipeline (Part 2A)

```
runStepAI(stepKey)
  → _getAIKeysForStep(stepKey)
    identity_voice → ['identity', 'voice']
    audience_offerings → ['audience', 'offerings']
    other → [stepKey]
  → W.isAIProcessing = true, _aiProgress set
  → _runPromptsSequential(keys, 0):
    → PROMPTS[key]() → { system, user }
    → _contextBlock() builds structured text (not raw JSON dump):
        Brand basics, scraped website data, discovery answers,
        known competitors, accepted sections
    → LLMService.callAI(prompt, successCb, errorCb, system)
    → parseAIResponse(rawText) — 3-stage JSON extraction
    → Distributes results to W.generatedSections
    → render() after each prompt (shows progress)
    → Continues to next prompt
  → W.isAIProcessing = false, autoSave(), render()
```

---

## CSS Design Tokens

```css
--bpw-primary: #1a73e8;        /* GoUltra Blue */
--bpw-success: #0d904f;        /* Execution Green */
--bpw-warning: #e37400;        /* Action Amber */
--bpw-error: #dc3545;
--bpw-font-heading: 'DM Sans', sans-serif;
--bpw-font-body: 'Plus Jakarta Sans', sans-serif;
--bpw-max-w: 820px;
--bpw-radius-sm: 6px; --bpw-radius-md: 10px; --bpw-radius-lg: 14px;
--bpw-sp-1: 4px; --bpw-sp-2: 8px; ... --bpw-sp-8: 48px;
Breakpoints: 1200px, 992px, 768px, 480px
```
