# BPW API Reference

## Part 1 Exports (window._bpw*)

### State & Navigation
| Export | Function | Description |
|--------|----------|-------------|
| `_bpwState` | W | State object (read/write) |
| `_bpwGoStep(id)` | goStep | Navigate to step by ID |
| `_bpwGoNext()` | goNext | Navigate to next step |
| `_bpwGoPrev()` | goPrev | Navigate to previous step |
| `_bpwSkipStep()` | skipStep | Skip current step |
| `_bpwRender()` | render | Re-render current view |
| `_bpwToast(msg, type)` | toast | Show notification (success/error/warning/info) |
| `_bpwBuildSteps()` | buildSteps | Rebuild step list from level+types |
| `_bpwDrupalSave(silent)` | drupalSave | Full save: textarea + exports + submit |
| `_bpwSaveProgress()` | saveProgress | Collect fields + drupalSave |

### AI & Sections
| Export | Function | Description |
|--------|----------|-------------|
| `_bpwLLMService` | LLMService | AI provider manager |
| `_bpwBuildAIContext()` | buildAIContext | Returns full brand context object |
| `_bpwGetLangInstruction()` | getLangInstruction | Returns language instruction suffix |
| `_bpwParseAIResponse(raw)` | parseAIResponse | Extracts JSON from AI text |
| `_bpwSetSectionState(key, state)` | setSectionState | Set section state |
| `_bpwAcceptSection(key, data)` | acceptSection | Accept (delegates to override) |
| `_bpwRejectSection(key)` | rejectSection | Reject section |
| `_bpwRenderAISection(key, title, body)` | renderAISection | Returns HTML for AI section card |

### Save & Export
| Export | Function | Description |
|--------|----------|-------------|
| `_bpwAutoSave()` | autoSave | Debounced save to textarea |
| `_bpwSyncToTextarea()` | syncToTextarea | Write JSON to textarea immediately |
| `_bpwBuildFinalProfile()` | buildFinalProfile | Build complete profile JSON |
| `_bpwSyncAllExportFields()` | syncAllExportFields | Populate all 7 Drupal fields |
| `_bpwBuildV2ExportContext(type)` | buildV2ExportContext | Build export JSON for type |
| `_bpwCollectCurrentStepFields()` | _collectCurrentStepFields | Gather form data from current step |

### Utilities
| Export | Function | Description |
|--------|----------|-------------|
| `_bpwEsc(str)` | esc | HTML escape |
| `_bpwIcon(name)` | icon | Returns FA icon HTML |
| `_bpwGenerateId(prefix)` | generateId | Random ID generator |
| `_bpwDeepClone(obj)` | deepClone | Deep clone via JSON |
| `_bpwHas(type)` | has | Check if brand has type |
| `_bpwIsLevel(lvl)` | isLevel | Check exact level |
| `_bpwIsLevelOrAbove(lvl)` | isLevelOrAbove | Check level >= |
| `_bpwConstants` | object | BRAND_TYPES, LANGUAGES, etc. |

## Part 2A Exports (window._bpwPart2A)

| Property | Description |
|----------|-------------|
| `initialized` | boolean |
| `runStepAI(stepKey)` | Run AI for step (handles merged) |
| `getSectionKeysForStep(stepKey)` | Get flat keys for step |
| `scrapeURL(url, type)` | Scrape website/social URL |
| `openSectionEditor(key)` | Open raw inline editor |
| `openRedoDialog(key)` | Open redo with guidance |
| `generateVoicePreview(format)` | Generate voice sample |
| `acceptAllForStep(stepKey)` | Accept all sections |
| `redoAllForStep(stepKey)` | Redo all sections |
| `PROMPTS` | Prompt template functions |

## Part 2B Exports (window._bpwPart2B)

| Property | Description |
|----------|-------------|
| `initialized` | boolean |
| `assembleModule(key, data)` | Map flat key to module field |
| `assembleIdentityFromSeed()` | Merge seed into identity |
| `assembleOfferingsType()` | Set offerings type from brand types |
| `collectBasicsForm()` | Collect basics form data |
| `collectImportForm()` | Collect import form data |
| `collectDiscoveryForm()` | Collect discovery answers |
| `collectCurrentStepData()` | Collect current step's form |
| `completeWizard()` | Finalize + save + submit |
| `exportJSON()` | Download JSON file |
| `ASSEMBLY_MAP` | Flat key → module.field map |

## Event Namespaces

| Namespace | File | Purpose |
|-----------|------|---------|
| `.bpw-nav` | Part 1 | Next button |
| `.bpw-prev` | Part 1 | Back button |
| `.bpw-skip` | Part 1 | Skip step |
| `.bpw-step` | Part 1 | Progress dot click |
| `.bpw-section-accept` | Part 1 | Accept section |
| `.bpw-manual-edit` | Part 1 | Open inline editor |
| `.bpw-save-manual` | Part 1 | Save manual edit |
| `.bpw-cancel-manual` | Part 1 | Cancel manual edit |
| `.bpw-copy-section` | Part 1 | Copy to clipboard |
| `.bpw-save-progress` | Part 1 | Header save button |
| `.bpw-review-edit` | Part 1 | Review card edit |
| `.bpw2a-run` | Part 2A | Run AI for step |
| `.bpw2a-redo` | Part 2A | Open redo dialog |
| `.bpw2a-chip` | Part 2A | Redo guidance chip |
| `.bpw2b-complete` | Part 2B | Complete wizard |
| `.bpw2b-export` | Part 2B | Export JSON |

## LLMService API

```javascript
LLMService.init()                    // Read config from DOM
LLMService.isConfigured()            // Has providers?
LLMService.getActiveProviders()      // Array of { id, label, activeModels }
LLMService.getActiveModels(pid)      // Array of models for provider
LLMService.getDefault()              // { provider, model, api_key, temperature }
LLMService.callAI(prompt, onSuccess, onError, system)  // Make AI call
LLMService.renderPicker()            // HTML for provider/model select
```
