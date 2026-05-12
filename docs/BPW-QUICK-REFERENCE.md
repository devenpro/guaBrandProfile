# BPW Quick Reference

## Global Resource Access Patterns

```javascript
// ===== AI: Check, configure, call =====
LLMService.isConfigured()                    // Has providers?
LLMService.getActiveProviders()              // [{id, label, activeModels}]
LLMService.getActiveModels('claude')         // [{id, label, temperature}]
LLMService.callAI(prompt, onOk, onErr, sys)  // Make AI call
W.aiProvider                                 // Current provider ID
W.aiModel                                    // Current model ID

// ===== Brand: Get context =====
W.seedContext.name                           // Brand name (from basics)
W.seedContext.description                    // Description
W.acceptedSections.identity.mission          // Mission (after AI + accept)
W.acceptedSections.voice.primary_tone        // Voice tone
buildAIContext()                             // Full context object for prompts

// ===== User: Preferences =====
W.data.ai_preferences.default_provider      // Saved provider preference
W.data.ai_preferences.custom_instructions   // Custom AI instructions

// ===== Drupal fields: Find & write =====
_findField('core')                           // jQuery element or null
_findField('meta')                           // Tries 5 selectors + wildcard
syncAllExportFields()                        // Populate all 7 fields at once
```

## File Locations
- **CSS:** bpw-app.css (Asset Injector, weight -100)
- **JS Part 1:** bpw-app.js (weight -100) — Core engine
- **JS Part 2A:** bpw-part2a.js (weight -99) — AI pipeline
- **JS Part 2B:** bpw-part2b.js (weight -98) — Assembly engine
- **Condition:** Body class contains `brand-profile`

## Field Selectors (Quick Lookup)

| Field | Primary Selector |
|-------|-----------------|
| JSON Data | `#edit-field-json-data-0-value` |
| Brand Core | `#edit-field-brand-core-0-value` |
| Brand Video | `#edit-field-brand-video-0-value` |
| Brand Content | `#edit-field-brand-content-0-value` |
| Brand SEO | `#edit-field-brand-seo-0-value` |
| Brand Social | `#edit-field-brand-social-0-value` |
| JSON Meta | `#edit-field-json-meta-0-value` |
| Activity Log | `#edit-field-activity-log-0-value` |
| Title | `#edit-title-0-value` |
| LLM Config | `.llm-config-data` |

## Common Tasks

### Fix a rendering bug
```bash
grep -n "function renderXxx" bpw-app.js   # Find render function
# Edit HTML generation
node -c bpw-app.js                         # Validate
```

### Fix an event handler
```bash
grep -n 'data-action="xxx"' bpw-app.js bpw-part2a.js bpw-part2b.js  # Find handler
# Check namespace ownership, edit, validate
```

### Add field to completeness scoring
Find `calcDetailedCompleteness()` → add to module's `fields` + `labels` arrays.
Verify field name matches what `ASSEMBLY_MAP` creates.

### Debug AI generation
```
[BPW] LLMService: 2 providers configured     ← Config loaded OK
[BPW-2A] Running AI for step: identity_voice  ← Triggered
[BPW-2A] AI call 1/2 : identity              ← Sequential
[BPW-2A] AI response for identity — length: 1842  ← Response
[BPW-2A] Generated: identity (6 sections)     ← Parsed OK
```

### Debug export field sync
```
[BPW] Export synced: core (1842 chars)        ← Populated
[BPW] Export fields synced: 5/7               ← Count
[BPW] Export fields NOT found in DOM: json_meta  ← Missing
```

### Debug initialization
```
[BPW] Blocked old editor — v2 schema detected     ← Old editor blocked
[BPW] Found textarea via: #edit-field-json-data-0-value  ← Found
[BPW] Existing data. schema: 2.0 status: in_progress    ← Resuming
[BPW] Wizard initialized. Level: growing Types: commercial, creator  ← Ready
```

## Key Patterns

| Pattern | Why | Where |
|---------|-----|-------|
| Accept override | Local closure can't be reassigned from outside | Part 1 checks `_bpwAcceptSectionOverride` |
| Inline assembly | Part 2B's W may be uninitialized during Part 1 init | `_ensureModulesAssembled()` has built-in AMAP |
| Form offscreen | `display:none` blocks submit button click | CSS: `position:fixed; left:-9999px` |
| Old editor block | Prevents bp-part1.js from loading v2 data | IIFE top wraps `Drupal.behaviors.bpPart1` |
| Entity decode | Drupal encodes `&` `"` `<` in rendered text | `_decodeEntities()` in LLMService |
| 3 attach triggers | Asset Injector may load after `Drupal.attachBehaviors` | behaviors + setTimeout + window.load |
| 2s LLM retry | Config div may not exist with hash navigation | `_retryInit()` in LLMService |

## CSS Class Cheat Sheet

| Class | Meaning |
|-------|---------|
| `.bpw-active` | Body class when wizard is active |
| `.bpw-ai-processing` | On `#bpwApp` during AI generation |
| `.bpw-ais-accepted` | Accepted section card (green) |
| `.bpw-ais-editing` | Section in manual edit mode |
| `.bpw-rv-complete` | Review card ≥80% |
| `.bpw-rv-partial` | Review card 1-79% |
| `.bpw-rv-empty` | Review card 0% |
| `.bpw-rv-missing` | Missing fields guidance text |
| `.bpw-btn-ai` | AI generation button (disabled during processing) |
| `.bpw-processing-banner` | Progress bar during AI |
| `.bpw-add-form` | Inline add form (offerings, personas) |

## Section State Flow

```
pending → [Write my own] → manual → [Save] → accepted
pending → [Generate AI]  → loading → generated → [Accept] → accepted
accepted → [Edit] → manual → [Save] → accepted
generated → [Redo] → redo dialog → loading → generated
```
