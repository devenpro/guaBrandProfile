/**
 * @category    ai
 * @purpose     AI action: content strategy. Generates content pillars,
 *              channels, SEO keywords, and hashtags.
 * @exports     window._bpwAIActions.content = { run, getPrompt }
 * @depends-on  window.LLMService, window.BrandService, window._bpwAIHelpers
 * @extracted-from  src/legacy/bpw-part2a.js PROMPTS.content (lines 267-271)
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

  function getPrompt() {
    var typeDesc = BrandService.typeLabels();
    var fieldReqs = '\n\nFIELD REQUIREMENTS:\n'
      + '- Every pillar MUST include: pillar (short name), description (1-2 sentences), topics (>= 3 concrete topics)\n'
      + '- Every channel MUST include: channel (e.g. Instagram, YouTube, Newsletter), purpose, frequency, format (e.g. "short-form vertical video", "long-form essay") — never leave format empty\n'
      + '- SEO keywords are 2-5-word phrases a real user would search\n'
      + '- Hashtags include the # prefix';
    return {
      system: 'You are a content strategist. Build a content and channel strategy for a ' + typeDesc + ' brand.' + BrandService.getLangSuffix(),
      user:   'Generate content strategy.' + BrandService.getContextBlock() +
              '\n\nReturn ONLY valid JSON:\n{\n  "content_pillars": [\n    {"pillar":"","description":"","topics":[""]}\n  ],\n  "content_channels": [\n    {"channel":"","purpose":"","frequency":"","format":""}\n  ],\n  "content_seo": ["keyword1", "keyword2", "keyword3"],\n  "content_hashtags": ["#hashtag1", "#hashtag2"]\n}\n\nGenerate 3-5 pillars, 3-5 channels, 8-12 SEO keywords, and 5-8 hashtags.' + fieldReqs + _jsonOnly()
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
    }, 'ai-content', prompt.system);
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.content = { run: run, getPrompt: getPrompt };
})();
