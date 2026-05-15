/**
 * @category    setup
 * @purpose     Autopilot orchestrator. Runs stages sequentially, owns the
 *              W.isAIProcessing flag while running, supports pause/recover/
 *              skip, and on completion auto-accepts every generated key
 *              into W.acceptedSections via the legacy acceptSection
 *              override (window._bpwAcceptSection).
 *
 * @exports     window._bpwSetupOrchestrator
 *                = {
 *                    start(queueIds, opts)
 *                      // opts: { mode: 'initial'|'delta', onStageEnter, onStageExit, onFinish }
 *                    pause()
 *                    resume()
 *                    recoverCurrent()        // re-run currently failed stage
 *                    skipCurrent()           // mark current failed stage skipped, advance
 *                    state()                 // → W.setup (or null)
 *                  }
 *
 * @depends-on  window._bpwState (W) — exclusive owner of W.isAIProcessing
 *              while setup is open.
 *              window._bpwAIActions — resolved by aiActionRef.
 *              window._bpwSetupStages.findStage()
 *              window._bpwAcceptSection (legacy assembly bridge),
 *              window._bpwSetSectionState, window._bpwSyncToTextarea,
 *              window._bpwAutoSave, window._bpwToast — all optional.
 *
 * Stage data flow:
 *   action.run(callback) → callback({ success, data, error })
 *   data is a flat object { <flatKey>: <value>, ... }
 *   Orchestrator writes each key into W.generatedSections AND
 *   calls setSectionState(k, 'generated'). On finishSetup, every key in
 *   W.generatedSections is auto-accepted, triggering the assembly bridge.
 */
(function() {
  'use strict';

  var LOG = '[BPW-setup]';
  var _hooks = {};   // onStageEnter / onStageExit / onFinish for current run
  var _resumeFn = null;  // when paused mid-queue, the function that resumes

  function _W() { return window._bpwState; }

  function _resolveAction(ref) {
    if (!ref || typeof ref !== 'string') return null;
    var parts = ref.split('.');
    if (parts.length !== 2) return null;
    var group = window._bpwAIActions && window._bpwAIActions[parts[0]];
    if (!group || typeof group[parts[1]] !== 'function') return null;
    return group[parts[1]];
  }

  function _setStatus(stageId, patch) {
    var W = _W();
    if (!W || !W.setup) return;
    var cur = W.setup.stageStatus[stageId] || {};
    var merged = {};
    var k;
    for (k in cur) if (cur.hasOwnProperty(k)) merged[k] = cur[k];
    for (k in patch) if (patch.hasOwnProperty(k)) merged[k] = patch[k];
    W.setup.stageStatus[stageId] = merged;
  }

  function _allDone(W) {
    var ids = (W.setup && W.setup.stagesQueue) || [];
    for (var i = 0; i < ids.length; i++) {
      var st = (W.setup.stageStatus[ids[i]] || {}).state;
      if (st !== 'done' && st !== 'skipped') return false;
    }
    return true;
  }

  function _depsMet(stage, W) {
    var deps = stage.dependsOn || [];
    for (var i = 0; i < deps.length; i++) {
      var st = ((W.setup && W.setup.stageStatus[deps[i]]) || {}).state;
      // Skipped counts as "done" for dependency purposes — the user
      // explicitly chose to move on. Only 'failed' (unresolved) blocks.
      if (st !== 'done' && st !== 'skipped') return false;
    }
    return true;
  }

  function _writeFlatKeys(data) {
    var W = _W();
    if (!W || !data || typeof data !== 'object') return;
    W.generatedSections = W.generatedSections || {};
    W.sectionStates = W.sectionStates || {};
    var setSection = window._bpwSetSectionState;
    for (var k in data) {
      if (!data.hasOwnProperty(k)) continue;
      W.generatedSections[k] = data[k];
      if (setSection) setSection(k, 'generated');
      else W.sectionStates[k] = 'generated';
    }
  }

  function _autoAcceptAll() {
    var W = _W();
    if (!W) return;
    var accept = window._bpwAcceptSection;
    var gen = W.generatedSections || {};
    for (var k in gen) {
      if (!gen.hasOwnProperty(k)) continue;
      // Only auto-accept keys not already manually accepted.
      var state = (W.sectionStates || {})[k];
      if (state === 'accepted') continue;
      if (accept) {
        try { accept(k, gen[k]); }
        catch (e) { console.warn(LOG, 'auto-accept failed for', k, e); }
      }
    }
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────
  function start(queueIds, opts) {
    var W = _W();
    if (!W) { console.warn(LOG, 'W not ready'); return; }
    opts = opts || {};
    _hooks = {
      onStageEnter: opts.onStageEnter || function() {},
      onStageExit:  opts.onStageExit  || function() {},
      onFinish:     opts.onFinish     || function() {}
    };

    // Initialise or reset W.setup.
    var status = {};
    for (var i = 0; i < queueIds.length; i++) status[queueIds[i]] = { state: 'queued' };
    W.setup = {
      open: true,
      mode: opts.mode || 'initial',
      currentStageId: queueIds[0] || '',
      stagesQueue: queueIds.slice(),
      stageStatus: status,
      totalElapsedMs: 0,
      paused: false,
      awaitingReview: null,
      startedAt: Date.now()
    };

    W.isAIProcessing = true;
    _runNext();
  }

  function pause() {
    var W = _W();
    if (!W || !W.setup) return;
    W.setup.paused = true;
  }

  function resume() {
    var W = _W();
    if (!W || !W.setup) return;
    W.setup.paused = false;
    if (typeof _resumeFn === 'function') {
      var fn = _resumeFn; _resumeFn = null;
      setTimeout(fn, 0);
    }
  }

  function recoverCurrent() {
    var W = _W();
    if (!W || !W.setup) return;
    var id = W.setup.currentStageId;
    if (!id) return;
    var st = (W.setup.stageStatus[id] || {}).state;
    if (st !== 'failed') return;
    _setStatus(id, { state: 'queued', error: undefined, startedAt: undefined, endedAt: undefined, elapsedMs: undefined });
    _runStage(id);
  }

  function skipCurrent() {
    var W = _W();
    if (!W || !W.setup) return;
    var id = W.setup.currentStageId;
    if (!id) return;
    _setStatus(id, { state: 'skipped', endedAt: Date.now() });
    if (W.setup.awaitingReview === id) W.setup.awaitingReview = null;
    _hooks.onStageExit(id);
    _advance();
  }

  // Clear the review gate and let the autopilot continue. Used by the
  // "Looks good — continue" button in the setup UI.
  function continueReview() {
    var W = _W();
    if (!W || !W.setup || !W.setup.awaitingReview) return;
    W.setup.awaitingReview = null;
    _advance();
  }

  // Re-run a specific stage (typically the one awaiting review) so the
  // user can correct extracted data by editing the setup form first
  // (custom instructions, description) and re-running.
  function rerunStage(stageId) {
    var W = _W();
    if (!W || !W.setup) return;
    if (!stageId) stageId = W.setup.awaitingReview || W.setup.currentStageId;
    if (!stageId) return;
    W.setup.awaitingReview = null;
    _setStatus(stageId, { state: 'queued', error: undefined, startedAt: undefined, endedAt: undefined, elapsedMs: undefined });
    W.setup.currentStageId = stageId;
    _runStage(stageId);
  }

  function state() {
    var W = _W();
    return (W && W.setup) || null;
  }

  // ── INTERNAL ───────────────────────────────────────────────────────
  function _runNext() {
    var W = _W();
    if (!W || !W.setup) return;
    if (W.setup.paused) { _resumeFn = _runNext; return; }
    // Block further stages until the user confirms the awaiting-review
    // stage. continueReview() / rerunStage() / skipCurrent() clear it.
    if (W.setup.awaitingReview) return;

    // Find the next queued stage.
    var queue = W.setup.stagesQueue;
    for (var i = 0; i < queue.length; i++) {
      var id = queue[i];
      var stState = (W.setup.stageStatus[id] || {}).state;
      if (stState === 'done' || stState === 'skipped') continue;
      if (stState === 'failed') {
        // Stop here — wait for the user to Recover or Skip.
        W.setup.currentStageId = id;
        return;
      }
      // queued — run it.
      W.setup.currentStageId = id;
      _runStage(id);
      return;
    }

    _finish();
  }

  function _runStage(id) {
    var W = _W();
    var stage = window._bpwSetupStages && window._bpwSetupStages.findStage(id);
    if (!stage) {
      _setStatus(id, { state: 'failed', error: 'Stage not found: ' + id, endedAt: Date.now() });
      _hooks.onStageExit(id);
      return _advance();
    }

    if (!_depsMet(stage, W)) {
      _setStatus(id, { state: 'failed', error: 'Unmet dependency', endedAt: Date.now() });
      _hooks.onStageExit(id);
      return _advance();
    }

    var action = _resolveAction(stage.aiActionRef);
    if (!action) {
      _setStatus(id, { state: 'failed', error: 'AI action missing: ' + stage.aiActionRef, endedAt: Date.now() });
      _hooks.onStageExit(id);
      return _advance();
    }

    _setStatus(id, { state: 'running', startedAt: Date.now() });
    _hooks.onStageEnter(id);

    // scrape.run has a different signature: (url, platformType, callback).
    // Special-case it; all other actions are (callback).
    var done = function(res) {
      var startedAt = (W.setup.stageStatus[id] || {}).startedAt || Date.now();
      var elapsedMs = Date.now() - startedAt;
      W.setup.totalElapsedMs += elapsedMs;
      var becameReview = false;
      if (res && res.success) {
        _writeFlatKeys(res.data);
        // Special: the scrape action returns extracted under `extracted`,
        // not `data` — fold it into W.importedAssets.website too.
        if (id === 'scrape' && res.extracted) {
          W.importedAssets = W.importedAssets || {};
          W.importedAssets.website = { url: res.url, status: 'success', extracted: res.extracted, analyzed_at: res.analyzed_at };
          // Auto-populate the new standalone social schema slot so the
          // user lands on the website-review stage with the AI's
          // extracted socials already in place to confirm or edit.
          // Only seed on first run; if the user already added rows,
          // don't trample them.
          var extracted = res.extracted || {};
          if (Array.isArray(extracted.social_profiles) && extracted.social_profiles.length) {
            W.acceptedSections = W.acceptedSections || {};
            W.acceptedSections.social = W.acceptedSections.social || { profiles: [] };
            if (!Array.isArray(W.acceptedSections.social.profiles)) W.acceptedSections.social.profiles = [];
            if (!W.acceptedSections.social.profiles.length) {
              W.acceptedSections.social.profiles = extracted.social_profiles
                .filter(function(sp) { return sp && (sp.url || sp.handle); })
                .map(function(sp) {
                  return { platform: sp.platform || 'other', handle: sp.handle || '', url: sp.url || '' };
                });
            }
          }
        }
        // Merged actions can return success with a `partial` flag when
        // one half (e.g. voice in identity_voice) failed but the other
        // succeeded. Mark the stage done but warn the user via toast so
        // they can re-run that section post-setup.
        var statusPatch = { state: 'done', endedAt: Date.now(), elapsedMs: elapsedMs };
        if (res.partial) {
          statusPatch.partial = res.partial;
          statusPatch.error = res.error || res.partial;
          if (typeof window._bpwToast === 'function') {
            window._bpwToast('Partial stage result (' + id + '): ' + (res.error || res.partial) + '. Re-run from the section view.', 'warning');
          }
          console.warn(LOG, 'partial stage result:', id, res.partial, res.error);
        }
        _setStatus(id, statusPatch);
        // Stages flagged needsReview pause the autopilot here so the
        // user can confirm the extracted data is actually about their
        // brand (not generic info hallucinated from the URL).
        if (stage.needsReview) {
          W.setup.awaitingReview = id;
          becameReview = true;
        }
      } else {
        _setStatus(id, { state: 'failed', error: (res && res.error) || 'Unknown error', endedAt: Date.now(), elapsedMs: elapsedMs });
      }
      _hooks.onStageExit(id);
      if (becameReview) return;
      _advance();
    };

    try {
      if (id === 'scrape') {
        var url = (W.seedContext && W.seedContext.url) || (W.seedContext && W.seedContext.website_url) || '';
        action(url, 'website', function(res) {
          // scrape callback shape: { status: 'success'|'failed'|'partial', url, extracted?, error? }
          done({ success: res && res.status === 'success', extracted: res && res.extracted, url: res && res.url, analyzed_at: res && res.analyzed_at, error: res && res.error });
        });
      } else {
        action(done);
      }
    } catch (e) {
      done({ success: false, error: e.message || String(e) });
    }
  }

  function _advance() {
    var W = _W();
    if (!W || !W.setup) return;
    var lastId = W.setup.currentStageId;
    var lastState = (W.setup.stageStatus[lastId] || {}).state;
    // If the last stage failed and wasn't recovered/skipped, stop here.
    if (lastState === 'failed') return;
    if (_allDone(W)) { _finish(); return; }
    setTimeout(_runNext, 0);
  }

  function _finish() {
    var W = _W();
    if (!W || !W.setup) return;
    _autoAcceptAll();
    W.setup.finishedAt = Date.now();
    W.setup.open = false;
    W.isAIProcessing = false;

    if (typeof window._bpwSyncToTextarea === 'function') window._bpwSyncToTextarea();
    if (typeof window._bpwAutoSave === 'function') window._bpwAutoSave();

    try { _hooks.onFinish(); } catch (e) { console.warn(LOG, 'onFinish threw', e); }
  }

  window._bpwSetupOrchestrator = {
    start: start,
    pause: pause,
    resume: resume,
    recoverCurrent: recoverCurrent,
    skipCurrent: skipCurrent,
    continueReview: continueReview,
    rerunStage: rerunStage,
    state: state
  };
})();
