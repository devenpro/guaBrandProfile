/**
 * @category    ai.actions
 * @purpose     Per-field + per-section refine engine. Backs the
 *              unified refine modal (src/ui/refine-modal.js).
 *
 *              refineField(path, instructions, override, cb):
 *                Narrow prompt. Reads current value at path, asks the
 *                AI to return a refined replacement under a "value"
 *                key (or the field's existing shape for arrays /
 *                objects), then writes back via path-store.
 *
 *              refineSection(sectionId, instructions, override, cb):
 *                Routes to an existing section action (market.run,
 *                identity.runIdentity, voice.run, audience.run,
 *                offerings.run, content.run, seo.audit). Pipes the
 *                user's custom instructions through
 *                seed._researchFocus so the existing prompt-context
 *                picks them up. The action already writes to
 *                acceptedSections on success, so we just persist +
 *                re-render after.
 *
 *              Provider/model override is temporary — applied before
 *              the call, restored in finally so the user's default
 *              isn't trampled.
 *
 *              Busy lock: W._refineBusy. Parallel refines toast-reject.
 *
 * @exports     window._bpwRefine = { refineField, refineSection }
 * @depends-on  window.LLMService, window._bpwAIHelpers,
 *              window._bpwPathStore, window._bpwAIActions, BrandService
 */
(function() {
  'use strict';

  var LOG = '[BPW-refine]';

  function _esc(s) {
    return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s);
  }

  function _W() { return window._bpwState; }

  function _setProviderOverride(override) {
    var W = _W();
    if (!W || !override) return null;
    var snap = { provider: W.aiProvider, model: W.aiModel };
    if (override.provider) W.aiProvider = override.provider;
    if (override.model)    W.aiModel    = override.model;
    return snap;
  }

  function _restoreProvider(snap) {
    var W = _W();
    if (!W || !snap) return;
    W.aiProvider = snap.provider;
    W.aiModel    = snap.model;
  }

  function _acquireLock() {
    var W = _W();
    if (!W) return false;
    if (W._refineBusy) {
      if (window._bpwToast) window._bpwToast('Another refine is in progress — wait for it to finish.', 'warning');
      return false;
    }
    W._refineBusy = true;
    return true;
  }
  function _releaseLock() { var W = _W(); if (W) W._refineBusy = false; }

  // ── refineField ───────────────────────────────────────────────────
  // Generic per-field prompt. Field-specific tightening (longer prose
  // for mission/vision, chip-list semantics for dos/donts, etc.) is
  // a follow-up — for now one well-anchored prompt handles all.
  function refineField(path, instructions, providerOverride, callback) {
    if (!_acquireLock()) return;
    var snap = _setProviderOverride(providerOverride);

    var store = window._bpwPathStore;
    var helpers = window._bpwAIHelpers || {};
    var brandSvc = window.BrandService;
    if (!store || !helpers.callAIWithRetry || !brandSvc) {
      _restoreProvider(snap); _releaseLock();
      if (callback) callback({ error: 'Refine prerequisites missing (path-store / AI helpers / BrandService).' });
      return;
    }

    var currentValue = store.get(path);
    var shapeHint = _shapeHint(currentValue);
    // Refine works on any field; derive the stage from the path's first
    // segment (identity.mission -> 'identity') so phaseGuidance can scale
    // depth of the rewrite to match the surrounding stage.
    var stageHint = (path || '').split('.')[0] || '';
    var ctxBlock = brandSvc.getContextBlock(stageHint);

    var system = 'You are a senior brand strategist refining one specific element of a brand profile. Stay strictly within the requested scope — do not rewrite adjacent fields. Match the existing voice and brand context. Output valid JSON only.';
    var userPrompt = 'Refine the following brand-profile field.\n\n'
      + 'Field path: ' + path + '\n'
      + 'Field shape: ' + shapeHint.label + '\n\n'
      + 'Current value:\n' + _stringify(currentValue) + '\n\n'
      + 'User instructions for this refine:\n' + (instructions || '(none — improve generally while keeping the same shape)') + '\n'
      + ctxBlock + '\n\n'
      + 'Return ONLY valid JSON in this exact shape:\n' + shapeHint.outputSchema + '\n'
      + 'No markdown, no commentary — JSON object only.';

    helpers.callAIWithRetry(userPrompt, function(rawText) {
      var parsed;
      try { parsed = helpers.parseJSON(rawText); }
      catch (e) {
        _restoreProvider(snap); _releaseLock();
        if (callback) callback({ error: 'Could not parse AI response as JSON.' });
        return;
      }
      var newValue = parsed && parsed.value !== undefined ? parsed.value : parsed;
      // For arrays, coerce single-string returns into the array shape.
      if (shapeHint.kind === 'array-string' && !Array.isArray(newValue)) {
        newValue = [String(newValue)];
      }
      store.set(path, newValue);
      store.persistAndRender();
      _restoreProvider(snap); _releaseLock();
      if (callback) callback({ success: true, value: newValue });
    }, function(err) {
      _restoreProvider(snap); _releaseLock();
      if (callback) callback({ error: typeof err === 'string' ? err : (err && err.message) || 'AI call failed' });
    }, 'ai-refine-field', system);
  }

  function _shapeHint(value) {
    if (Array.isArray(value)) {
      if (value.length && typeof value[0] === 'object') {
        return { kind: 'array-object', label: 'array of objects', outputSchema: '{ "value": [ { ... same shape as current items ... } ] }' };
      }
      return { kind: 'array-string', label: 'array of strings', outputSchema: '{ "value": ["string1", "string2", ...] }' };
    }
    if (value && typeof value === 'object') {
      return { kind: 'object', label: 'object', outputSchema: '{ "value": { ... same keys as current value ... } }' };
    }
    return { kind: 'string', label: 'plain text', outputSchema: '{ "value": "refined text" }' };
  }

  function _stringify(v) {
    if (v == null) return '(empty)';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); }
  }

  // ── refineSection ─────────────────────────────────────────────────
  // Routes to the existing section AI action. Custom instructions
  // flow through seed._researchFocus so getContextBlock() includes
  // them in every downstream prompt without prompt-by-prompt plumbing.
  //
  // Each entry: { group, fn, args, kind }
  //   args: () => extra positional args BEFORE the callback (seo.audit
  //         takes a "focus" string first).
  //   kind: 'flat-keys' (default) → data is a {flatKey: value} map
  //                                  → _writeFlatKeys + auto-accept.
  //         'section'              → data is the whole section object
  //                                  → write straight to
  //                                    W.acceptedSections[sectionId].
  var SECTION_ACTIONS = {
    identity:  { group: 'identity',  fn: 'runIdentity', kind: 'flat-keys' },
    voice:     { group: 'voice',     fn: 'run',         kind: 'flat-keys' },
    audience:  { group: 'audience',  fn: 'run',         kind: 'flat-keys' },
    offerings: { group: 'offerings', fn: 'run',         kind: 'flat-keys' },
    market:    { group: 'market',    fn: 'run',         kind: 'flat-keys' },
    content:   { group: 'content',   fn: 'run',         kind: 'flat-keys' },
    seo:       { group: 'seo',       fn: 'audit',       kind: 'section', args: function() { return ['']; } }
  };

  function _writeFlatKeys(data) {
    var W = _W();
    if (!W || !data || typeof data !== 'object') return;
    W.generatedSections = W.generatedSections || {};
    var setSection = window._bpwSetSectionState;
    var accept = window._bpwAcceptSection;
    for (var k in data) {
      if (!data.hasOwnProperty(k)) continue;
      W.generatedSections[k] = data[k];
      if (setSection) setSection(k, 'generated');
      // Auto-accept refined output — the user already opted in by
      // clicking Refine, so don't make them double-confirm.
      if (accept) {
        try { accept(k, data[k]); }
        catch (e) { console.warn(LOG, 'accept failed for', k, e); }
      }
    }
  }

  function refineSection(sectionId, instructions, providerOverride, callback) {
    var mapping = SECTION_ACTIONS[sectionId];
    if (!mapping) {
      if (callback) callback({ error: 'No AI action registered for section "' + sectionId + '".' });
      return;
    }
    if (!_acquireLock()) return;
    var snap = _setProviderOverride(providerOverride);
    var W = _W();
    var seed = W.seedContext = W.seedContext || {};
    var previousFocus = seed._researchFocus;
    if (instructions) seed._researchFocus = instructions;

    var actions = window._bpwAIActions || {};
    var group = actions[mapping.group] || {};
    var action = group[mapping.fn];
    if (typeof action !== 'function') {
      seed._researchFocus = previousFocus;
      _restoreProvider(snap); _releaseLock();
      if (callback) callback({ error: 'Section action ' + mapping.group + '.' + mapping.fn + ' not loaded.' });
      return;
    }

    function done(res) {
      seed._researchFocus = previousFocus;
      _restoreProvider(snap); _releaseLock();
      if (!res || !res.success) {
        if (callback) callback({ error: (res && res.error) || 'Section action failed' });
        return;
      }
      if (mapping.kind === 'section') {
        W.acceptedSections = W.acceptedSections || {};
        W.acceptedSections[sectionId] = res.data || {};
      } else {
        _writeFlatKeys(res.data);
      }
      if (window._bpwPathStore) window._bpwPathStore.persistAndRender();
      if (callback) callback({ success: true });
    }

    var extraArgs = mapping.args ? mapping.args() : [];
    try {
      action.apply(null, extraArgs.concat([done]));
    } catch (e) {
      seed._researchFocus = previousFocus;
      _restoreProvider(snap); _releaseLock();
      if (callback) callback({ error: e && e.message || String(e) });
    }
  }

  window._bpwRefine = {
    refineField: refineField,
    refineSection: refineSection
  };
})();
