/**
 * @category    ai
 * @purpose     AI action: target-audience profile. Generates the primary
 *              description, 2-3 segments, and (at Growing/Deep) detailed
 *              personas. Also exposes `generateMorePersonas` as a
 *              post-setup inline action surfaced in the Audience view.
 *
 *              Owns the W._audiencePhase state machine
 *              ('initial' | 'audience_generated' | 'with_offerings').
 *
 * @exports     window._bpwAIActions.audience = {
 *                run, getPrompt, runMergedAudienceOfferings,
 *                generateMorePersonas
 *              }
 *
 * @depends-on  window.LLMService, window.BrandService, window._bpwAIHelpers
 * @extracted-from  src/legacy/bpw-part2a.js PROMPTS.audience +
 *                  PROMPTS.offerings (merged variant)
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

  function _has(t) { return W && W.brandTypes && W.brandTypes.indexOf(t) !== -1; }
  function _isLevel(l) { return W && W.brandLevel === l; }
  function _jsonOnly() { return '\n\nRESPOND WITH VALID JSON ONLY. No markdown, no preamble.'; }

  function getPrompt() {
    var typeDesc = BrandService.typeLabels();
    var personaCount = _isLevel('deep') ? 3 : _isLevel('growing') ? 2 : 0;
    var personaSchema = personaCount > 0
      ? ',\n  "audience_personas": [\n    {"name":"","role":"","age":"","story":"","pain_points":[""],"goals":[""],"decision_criteria":[""],"journey":""}\n  ]'
      : '';
    var personaInstr = personaCount > 0 ? ' Generate ' + personaCount + ' detailed personas.' : '';
    return {
      system: 'You are an expert audience researcher. Profile the target audience for a ' + typeDesc + ' brand.' + BrandService.getLangSuffix(),
      user:   'Generate audience profile.' + BrandService.getContextBlock() +
              '\n\nReturn ONLY valid JSON:\n{\n  "audience_primary": "2-3 sentence primary audience description",\n  "audience_segments": [\n    {"name":"","description":"","pain_points":[""],"goals":[""],"channels":[""]}\n  ]' + personaSchema + '\n}\n\nGenerate 2-3 segments.' + personaInstr + _jsonOnly()
    };
  }

  function _offeringsPrompt() {
    var typeDesc = BrandService.typeLabels();
    var offeringsType = _has('creator')   ? 'content formats and digital products'
                     : _has('nonprofit')  ? 'programs and services'
                     : _has('local')      ? 'services'
                                          : 'products and services';
    var creatorFields  = _has('creator')    ? ',\n  "offerings_content": "description of content formats and publishing approach",\n  "offerings_revenue": [\n    {"stream":"","status":"active","notes":""}\n  ]' : '';
    var commercFields  = _has('commercial') ? ',\n  "offerings_pricing": "brief pricing model description"' : '';
    var nonprofFields  = _has('nonprofit')  ? ',\n  "offerings_programs": [\n    {"name":"","category":"","description":"","features":[""],"target_audience":"","status":"active"}\n  ]' : '';
    return {
      system: 'You are a business strategist. Structure the ' + offeringsType + ' for a ' + typeDesc + ' brand.' + BrandService.getLangSuffix(),
      user:   'Generate offerings profile.' + BrandService.getContextBlock() +
              '\n\nReturn ONLY valid JSON:\n{\n  "offerings_items": [\n    {"name":"","category":"","description":"","features":[""],"benefits":[""],"target_audience":"","status":"active"}\n  ]' + creatorFields + commercFields + nonprofFields + '\n}\n\nGenerate 3-6 offerings based on available context.' + _jsonOnly()
    };
  }

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

  function run(callback) {
    _resolveHelpers();
    _callPrompt(getPrompt(), 'ai-audience', function(res) {
      if (res.success && W) W._audiencePhase = 'audience_generated';
      if (callback) callback(res);
    });
  }

  /**
   * Merged audience + offerings stage for New/Growing levels.
   * Fires both prompts sequentially and merges the responses.
   */
  function runMergedAudienceOfferings(callback) {
    _resolveHelpers();
    _callPrompt(getPrompt(), 'ai-audience-offerings', function(audRes) {
      if (!audRes.success) { if (callback) callback(audRes); return; }
      if (W) W._audiencePhase = 'with_offerings';

      _callPrompt(_offeringsPrompt(), 'ai-audience-offerings', function(offRes) {
        if (!offRes.success) {
          if (callback) callback({ success: true, data: audRes.data, partial: 'offerings_failed', error: offRes.error });
          return;
        }
        var merged = {};
        var k;
        for (k in audRes.data) if (audRes.data.hasOwnProperty(k)) merged[k] = audRes.data[k];
        for (k in offRes.data) if (offRes.data.hasOwnProperty(k)) merged[k] = offRes.data[k];
        if (callback) callback({ success: true, data: merged });
      });
    });
  }

  function generateMorePersonas(customGuidance, callback) {
    _resolveHelpers();
    if (!LLMService || !LLMService.isConfigured()) {
      if (callback) callback({ success: false, error: 'No AI providers configured' });
      return;
    }
    var existing = (BrandService.getAudience().personas || []).map(function(p) { return p.name || ''; }).filter(Boolean);
    var prompt = {
      system: 'You are an expert audience researcher building detailed buyer personas.' + BrandService.getLangSuffix(),
      user:   'Generate 2-3 additional detailed personas for this brand.' + BrandService.getContextBlock() +
              (existing.length ? '\n\nDO NOT repeat these existing personas: ' + existing.join(', ') : '') +
              (customGuidance ? '\n\nUser direction: ' + customGuidance : '') +
              '\n\nReturn ONLY valid JSON:\n{\n  "personas": [\n    {"name":"","role":"","age":"","story":"","pain_points":[""],"goals":[""],"decision_criteria":[""],"journey":""}\n  ]\n}' + _jsonOnly()
    };
    callAIWithRetry(prompt.user, function(rawText) {
      var parsed = parseJSON(rawText);
      if (callback) callback({ success: true, personas: parsed.personas || [] });
    }, function(err) {
      if (callback) callback({ success: false, error: err });
    }, 'ai-generate-more-personas', prompt.system);
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.audience = {
    run: run,
    getPrompt: getPrompt,
    runMergedAudienceOfferings: runMergedAudienceOfferings,
    generateMorePersonas: generateMorePersonas
  };
})();
