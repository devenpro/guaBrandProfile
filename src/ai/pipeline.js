// Pure helpers from bpw-app.js §24 AI PIPELINE.
// acceptSection and renderAISection stay in legacy for now — the
// former touches autoSave / window._bpwAcceptSectionOverride and the
// latter is UI rendering targeted for src/ui/ in a later stage.
import { W } from '../core/state.js';
import { LANG_NAMES } from '../core/constants.js';

export function buildAIContext() {
  return {
    brand_level: W.brandLevel,
    brand_types: W.brandTypes,
    brand_subtypes: W.brandSubtypes,
    language: W.language,
    seed: W.seedContext,
    imported: W.importedAssets,
    discovery: W.discoveryAnswers,
    accepted: W.acceptedSections
  };
}

export function getLangInstruction() {
  if (!W.language || W.language === 'en') return '';
  var name = LANG_NAMES[W.language] || W.language;
  return '\n\nIMPORTANT: Generate ALL content in ' + name + '. JSON keys remain in English. Only values should be in ' + name + '.';
}

export function parseAIResponse(rawText) {
  if (!rawText || !rawText.trim()) return { success: false, error: 'Empty AI response', rawText: '' };
  try { return { success: true, data: JSON.parse(rawText) }; } catch (e) {}
  var cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  try { return { success: true, data: JSON.parse(cleaned) }; } catch (e) {}
  var s = cleaned.indexOf('{');
  if (s === -1) s = cleaned.indexOf('[');
  if (s !== -1) {
    var open = cleaned.charAt(s), close = open === '{' ? '}' : ']';
    var depth = 0, inStr = false, escNext = false;
    for (var i = s; i < cleaned.length; i++) {
      var ch = cleaned.charAt(i);
      if (escNext) { escNext = false; continue; }
      if (ch === '\\') { escNext = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === open) depth++;
      if (ch === close) { depth--; if (depth === 0) { try { return { success: true, data: JSON.parse(cleaned.substring(s, i + 1)) }; } catch (e2) { break; } } }
    }
  }
  return { success: false, error: 'Could not parse AI response', rawText: rawText };
}

export function setSectionState(key, state) {
  W.sectionStates[key] = state;
}

export function rejectSection(key) {
  delete W.acceptedSections[key];
  setSectionState(key, 'rejected');
}
