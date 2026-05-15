/**
 * @category    ai
 * @purpose     AI action: brand offerings (products, services, content,
 *              programs depending on brand type). Used as a standalone
 *              stage at Deep level; merged with audience for New/Growing
 *              (see actions/audience.js#runMergedAudienceOfferings).
 * @exports     window._bpwAIActions.offerings = { run, getPrompt }
 * @depends-on  window.LLMService, window.BrandService, window._bpwAIHelpers
 * @extracted-from  src/legacy/bpw-part2a.js PROMPTS.offerings (lines 259-264)
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
  function _jsonOnly() { return '\n\nRESPOND WITH VALID JSON ONLY. No markdown, no preamble.'; }

  function getPrompt() {
    var typeDesc = BrandService.typeLabels();
    var offeringsType = _has('creator')   ? 'content formats and digital products'
                     : _has('nonprofit')  ? 'programs and services'
                     : _has('local')      ? 'services'
                                          : 'products and services';
    var creatorFields = _has('creator')    ? ',\n  "offerings_content": "description of content formats and publishing approach",\n  "offerings_revenue": [\n    {"stream":"","status":"active","notes":""}\n  ]' : '';
    var commercFields = _has('commercial') ? ',\n  "offerings_pricing": "brief pricing model description"' : '';
    var nonprofFields = _has('nonprofit')  ? ',\n  "offerings_programs": [\n    {"name":"","category":"","description":"","features":[""],"target_audience":"","status":"active"}\n  ]' : '';
    return {
      system: 'You are a business strategist. Structure the ' + offeringsType + ' for a ' + typeDesc + ' brand.' + BrandService.getLangSuffix(),
      user:   'Generate offerings profile.' + BrandService.getContextBlock() +
              '\n\nReturn ONLY valid JSON:\n{\n  "offerings_items": [\n    {"name":"","category":"","description":"","features":[""],"benefits":[""],"target_audience":"","status":"active"}\n  ]' + creatorFields + commercFields + nonprofFields + '\n}\n\nGenerate 3-6 offerings based on available context.' + _jsonOnly()
    };
  }

  function run(callback) {
    _resolveHelpers();
    if (!LLMService || !LLMService.isConfigured()) {
      if (callback) callback({ success: false, error: 'No AI providers configured' });
      return;
    }
    var prompt = getPrompt();
    callAIWithRetry(prompt.user, function(rawText) {
      var parsed = parseJSON(rawText);
      if (callback) callback({ success: true, data: parsed });
    }, function(err) {
      if (callback) callback({ success: false, error: err });
    }, 'ai-offerings', prompt.system);
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.offerings = { run: run, getPrompt: getPrompt };
})();
