/**
 * @category    ai
 * @purpose     AI action: brand identity. Owns the two-phase prompt
 *              machine — first generate 3 mission options for the user
 *              to choose from, then generate the full identity block
 *              (vision, values, archetype, pitch) anchored on the chosen
 *              mission.
 *
 *              Phase state lives on W._identityPhase:
 *                'initial' | 'mission_options' — runMissionOnly() is next
 *                'mission_selected'             — runIdentity() is next
 *                'full_complete'                — re-running regenerates
 *                                                  the whole block
 *
 * @exports     window._bpwAIActions.identity = {
 *                runMissionOnly, runIdentity, runMergedIdentityVoice,
 *                getMissionOnlyPrompt, getIdentityPrompt
 *              }
 *
 *              Each `run*` callback receives `{ success, data?, error? }`
 *              where `data` holds flat keys (identity_mission_options,
 *              identity_mission, identity_vision, identity_values,
 *              identity_archetype, identity_pitch — and for the merged
 *              variant, also voice_*).
 *
 * @depends-on  window.LLMService, window.BrandService, window._bpwAIHelpers,
 *              window._bpwState (for W._identityPhase + W.acceptedSections.identity)
 * @extracted-from  src/legacy/bpw-part2a.js PROMPTS.identity_mission_only,
 *                  PROMPTS.identity, PROMPTS.voice (merged variant); plus
 *                  _getAIKeysForStep + _handlePhaseTransition phase logic.
 */
(function() {
  'use strict';

  var W, LLMService, BrandService, parseJSON, callAIWithRetry;

  function _resolveHelpers() {
    W = window._bpwState;
    LLMService = window.LLMService;
    BrandService = window.BrandService;
    var H = window._bpwAIHelpers || {};
    parseJSON = H.parseJSON;
    callAIWithRetry = H.callAIWithRetry;
  }

  function _jsonOnly() { return '\n\nRESPOND WITH VALID JSON ONLY. No markdown, no preamble.'; }

  // ── PROMPTS ────────────────────────────────────────────────────────
  function getMissionOnlyPrompt() {
    var typeDesc = BrandService.typeLabels();
    return {
      system: 'You are an expert brand strategist. Generate 3 compelling, distinct mission statement options for a ' + typeDesc + ' brand. Each should capture a different strategic angle or emphasis.' + BrandService.getLangSuffix(),
      user:   'Generate 3 mission statement options for this brand. Each should be unique in angle, tone, or strategic emphasis.' + BrandService.getContextBlock() +
              '\n\nReturn ONLY valid JSON:\n{\n  "identity_mission_options": ["mission option 1 — clear and concise", "mission option 2 — different angle", "mission option 3 — different emphasis"]\n}' + _jsonOnly()
    };
  }

  function getIdentityPrompt() {
    var typeDesc = BrandService.typeLabels();
    var id = BrandService.getIdentity();
    var generated = (W && W.generatedSections) || {};

    var selectedMission = '';
    if (W && W.sectionStates && W.sectionStates.identity_mission === 'accepted' && id.mission) {
      selectedMission = id.mission;
    } else if (generated.identity_mission) {
      selectedMission = generated.identity_mission;
    }

    var missionNote = selectedMission
      ? '\n\nIMPORTANT: The user has already chosen this mission statement: "' + selectedMission + '"\nAll identity elements MUST align with and build upon this chosen mission. Do NOT change the mission.'
      : '';

    var missionFields = selectedMission
      ? ''
      : '\n  "identity_mission_options": ["mission option 1", "mission option 2", "mission option 3"],\n  "identity_mission": "the recommended mission statement",';

    return {
      system: 'You are an expert brand strategist. Create brand identity elements for a ' + typeDesc + ' brand.' +
              (selectedMission ? ' The mission is already decided — build everything else around it.'
                               : ' Generate multiple alternatives for mission so the user can choose.') +
              BrandService.getLangSuffix(),
      user:   'Generate brand identity elements.' + missionNote + BrandService.getContextBlock() +
              '\n\nReturn ONLY valid JSON:\n{' + missionFields +
              '\n  "identity_vision": "vision statement aligned with the mission",\n  "identity_values": [\n    {"value":"","description":""}\n  ],\n  "identity_archetype": "string — one of the 12 brand archetypes with brief explanation",\n  "identity_pitch": "30-second elevator pitch"\n}' + _jsonOnly()
    };
  }

  function getVoicePrompt() {
    var typeDesc = BrandService.typeLabels();
    return {
      system: 'You are an expert brand voice strategist. Define the complete voice, tone, and messaging framework for a ' + typeDesc + ' brand.' + BrandService.getLangSuffix(),
      user:   'Generate voice and messaging framework.' + BrandService.getContextBlock() +
              '\n\nReturn ONLY valid JSON:\n{\n  "voice_tone": "primary tone description — 2-3 sentences",\n  "voice_personality": ["trait1", "trait2", "trait3", "trait4", "trait5"],\n  "voice_dos": ["rule1", "rule2", "rule3", "rule4", "rule5"],\n  "voice_donts": ["rule1", "rule2", "rule3", "rule4", "rule5"],\n  "voice_preferred": ["term1", "term2", "term3"],\n  "voice_avoided": ["term1", "term2", "term3"],\n  "messaging_primary": "primary brand message — one powerful sentence",\n  "messaging_supporting": ["supporting message 1", "supporting message 2", "supporting message 3"],\n  "messaging_headlines": [\n    {"context":"landing page","headline":""},\n    {"context":"social media bio","headline":""},\n    {"context":"email subject","headline":""}\n  ],\n  "voice_sample": "A 3-4 sentence sample text written IN the brand voice — a product announcement or content piece"\n}' + _jsonOnly()
    };
  }

  // ── RUNNERS ────────────────────────────────────────────────────────
  function _callPrompt(prompt, actionId, callback) {
    _resolveHelpers();
    if (!LLMService || !LLMService.isConfigured()) {
      if (callback) callback({ success: false, error: 'No AI providers configured' });
      return;
    }
    callAIWithRetry(prompt.user, function(rawText) {
      var parsed = parseJSON(rawText);
      if (callback) callback({ success: true, data: parsed });
    }, function(err) {
      if (callback) callback({ success: false, error: err });
    }, actionId, prompt.system);
  }

  function runMissionOnly(callback) {
    _resolveHelpers();
    _callPrompt(getMissionOnlyPrompt(), 'ai-identity-mission', function(res) {
      if (res.success && W) W._identityPhase = 'mission_options';
      if (callback) callback(res);
    });
  }

  function runIdentity(callback) {
    _resolveHelpers();
    _callPrompt(getIdentityPrompt(), 'ai-identity', function(res) {
      if (res.success && W) W._identityPhase = 'full_complete';
      if (callback) callback(res);
    });
  }

  /**
   * Runs identity + voice as a merged stage for New/Growing levels.
   * Picks the right identity prompt based on W._identityPhase, then
   * also runs the voice prompt; merges both responses into one
   * `data` payload that the orchestrator writes into W.generatedSections.
   */
  function runMergedIdentityVoice(callback) {
    _resolveHelpers();
    var phase = (W && W._identityPhase) || 'initial';
    var idPrompt = (phase === 'initial' || phase === 'mission_options')
      ? getMissionOnlyPrompt()
      : getIdentityPrompt();

    _callPrompt(idPrompt, 'ai-identity-voice', function(idRes) {
      if (!idRes.success) { if (callback) callback(idRes); return; }

      // Advance the phase machine.
      if (W) {
        if (phase === 'initial' || phase === 'mission_options') {
          W._identityPhase = 'mission_options';
        } else {
          W._identityPhase = 'full_complete';
        }
      }

      // If we only ran mission_options, return now — voice waits until
      // the user picks a mission and we re-enter with phase = 'mission_selected'.
      if (phase === 'initial' || phase === 'mission_options') {
        if (callback) callback(idRes);
        return;
      }

      _callPrompt(getVoicePrompt(), 'ai-identity-voice', function(vRes) {
        if (!vRes.success) {
          if (callback) callback({ success: true, data: idRes.data, partial: 'voice_failed', error: vRes.error });
          return;
        }
        var merged = {};
        var k;
        for (k in idRes.data) if (idRes.data.hasOwnProperty(k)) merged[k] = idRes.data[k];
        for (k in vRes.data)  if (vRes.data.hasOwnProperty(k))  merged[k]  = vRes.data[k];
        if (callback) callback({ success: true, data: merged });
      });
    });
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.identity = {
    runMissionOnly: runMissionOnly,
    runIdentity: runIdentity,
    runMergedIdentityVoice: runMergedIdentityVoice,
    getMissionOnlyPrompt: getMissionOnlyPrompt,
    getIdentityPrompt: getIdentityPrompt,
    getVoicePrompt: getVoicePrompt
  };
})();
