# BPW Development Guide

## Using Global Resources

### Making AI Calls

```javascript
// Check if AI is configured
if (!LLMService || !LLMService.isConfigured()) {
  toast('No AI providers configured.', 'warning');
  return;
}

// Get current provider/model
var provider = W.aiProvider;   // e.g., 'claude'
var model = W.aiModel;         // e.g., 'claude-3.5-sonnet'

// Make a simple AI call
LLMService.callAI(
  'Your prompt here',                    // user message
  function(responseText) { /* success */ },
  function(errorMsg) { /* error */ },
  'You are a brand strategist.'          // system prompt
);

// Build brand context for prompts
var ctx = buildAIContext();
// Returns: { seed, imported, discovery, accepted, brand_level, brand_types, language }
```

### Accessing Brand Context

```javascript
// Basics (always available after basics step)
var name = W.seedContext.name;
var desc = W.seedContext.description;
var url  = W.seedContext.website_url;

// Assembled modules (available after AI generation + accept)
var tone = (W.acceptedSections.voice || {}).primary_tone;
var mission = (W.acceptedSections.identity || {}).mission;

// Scraped data
var webData = (W.importedAssets.website || {}).extracted;
if (webData) {
  var tagline = webData.tagline;
  var offerings = webData.offerings;  // array
}
```

### Reading/Writing Drupal Fields

```javascript
// Find any field with fallback selectors
var $field = _findField('core');  // Returns jQuery element or null

// Write to a field
if ($field) $field.val(JSON.stringify(data));

// All fields are synced automatically via syncAllExportFields()
// Called from drupalSave() before form submission
```

### Hash Navigation Issue

AI config div may not be in DOM when page loads with URL hash. Pattern:

```javascript
// Init: try to load
var raw = _tryParseConfig($el);
if (!raw) {
  // Schedule retry
  setTimeout(function() { _retryInit(); }, 2000);
}
```

Always include retry logic when reading global DOM elements.

---

## Adding a New Wizard Step

### Checklist
1. **`buildSteps()`** — Add step with condition
2. **`STEP_RENDERERS`** — Map step ID to render function
3. **Render function** — Build HTML
4. **`setupStepEvents()`** — Add case for custom events
5. **Part 2A PROMPTS** — Add prompt template if AI-powered
6. **Part 2A `getSectionKeysForStep()`** — Map step to section keys
7. **Part 2B `ASSEMBLY_MAP`** — Map flat keys to module.field
8. **Review** — Add to `buildReviewSections()` and `calcDetailedCompleteness()`
9. **Export** — Add fields to `buildV2ExportContext()` if needed

### Example
```javascript
// 1. buildSteps — add after content step
if (has('commercial')) {
  steps.push({ id: 'pricing', label: 'Pricing', icon: 'tag' });
}

// 2. STEP_RENDERERS
STEP_RENDERERS.pricing = renderPricing;

// 3. Render function
function renderPricing() {
  var h = renderStepHeader('Pricing Strategy', 'AI suggests pricing models.');
  var gen = W.generatedSections;
  h += renderAISection('pricing_model', 'Pricing model', gen.pricing_model);
  h += renderAISection('pricing_tiers', 'Price tiers', gen.pricing_tiers);
  h += '<div class="bpw-ai-trigger-row">...Generate button...</div>';
  h += renderBulkActions('pricing');
  h += renderActions({ showSkip: true });
  return h;
}
```

---

## Adding an AI Section

1. **Prompt** (Part 2A): Add key to JSON schema in prompt template
2. **Section keys** (Part 2A): Add to `getSectionKeysForStep()`
3. **Assembly** (Part 2B): `new_key: { module: 'target', field: 'name' }`
4. **Render**: `h += renderAISection('new_key', 'Title', gen.new_key);`
5. **Completeness**: Add to `calcDetailedCompleteness()` checks
6. **Manual edit type**: Add to `SECTION_TYPES` (text/textarea/list/chips/values/json)

---

## Adding Manual Input

Every `renderAISection()` automatically provides:
- "Write my own" button in `pending` state
- Inline editor based on `SECTION_TYPES[key]`:

| Type | Input | Format |
|------|-------|--------|
| `text` | Single-line input | Plain text |
| `textarea` | Multi-line textarea | Plain text |
| `list` | Textarea | One item per line |
| `chips` | Input | Comma-separated |
| `values` | Textarea | `Value \| Description` per line |
| `json` | Textarea (monospace) | Raw JSON |

```javascript
// Add type for a new section
SECTION_TYPES.pricing_model = 'text';
SECTION_TYPES.pricing_tiers = 'json';
```

---

## Adding a New Export Field

```javascript
// 1. Add selector
EXPORT_FIELD_SELECTORS.newfield = [
  '#edit-field-new-field-0-value',
  'textarea[name="field_new_field[0][value]"]',
  '[data-drupal-selector="edit-field-new-field-0-value"]',
  '.field--name-field-new-field textarea'
];

// 2. Add builder (or add case to buildV2ExportContext)
function buildNewFieldExport() {
  var acc = W.acceptedSections || {};
  return { /* curated data */ };
}

// 3. Add to syncAllExportFields
var $nf = _findField('newfield');
if ($nf) { $nf.val(JSON.stringify(buildNewFieldExport())); synced++; }
```

---

## Key Patterns

### Accept Section Override
Part 1's `acceptSection()` checks `window._bpwAcceptSectionOverride`. Part 2B sets it. The override runs `assembleModule()` AND stores flat key. Never call Part 2B's functions during Part 1 init.

### Inline Assembly Fallback
`_ensureModulesAssembled()` does assembly inline using Part 1's `W`. Has a built-in copy of ASSEMBLY_MAP. Safe at any time. Runs at start of `renderReview()` and `buildV2ExportContext()`.

### Processing Lock
`W.isAIProcessing` + `W._aiProgress` set in `runStepAI()`, cleared when done. CSS `.bpw-ai-processing` on `#bpwApp` disables buttons.

---

## Validation Checklist

After every change:
1. `node -c bpw-app.js`
2. `node -c bpw-part2a.js`
3. `node -c bpw-part2b.js`
4. Verify `acceptSection` calls go through override
5. Verify `_fieldScore` field names match ASSEMBLY_MAP output
6. Verify export contexts reference correct module fields
7. Test: new profile → basics → generate → accept → review → save → reload → resume
