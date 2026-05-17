/**
 * @category    ai
 * @purpose     AI action: SEO audit. NEW post-setup inline action surfaced
 *              in the SEO view. Produces keyword clusters, competitor
 *              analysis, and content gap recommendations grounded in the
 *              brand profile already built.
 * @exports     window._bpwAIActions.seo = { audit, getAuditPrompt }
 * @depends-on  window.LLMService, window.BrandService, window._bpwAIHelpers
 *
 * Unlike the setup-stage actions (which write into W.generatedSections
 * via the orchestrator), inline actions return their payload to the
 * view that called them, which appends into W.acceptedSections directly.
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

  function getAuditPrompt(focus) {
    var typeDesc = BrandService.typeLabels();
    var focusLine = focus ? '\n\nFocus area: ' + focus : '';
    return {
      system: 'You are an SEO strategist. Run a structured audit for a ' + typeDesc + ' brand.' + BrandService.getLangSuffix(),
      user:   'Run an SEO audit for this brand.' + BrandService.getContextBlock('seo') + focusLine +
              '\n\nReturn ONLY valid JSON:\n{\n  "keyword_clusters": [\n    {"cluster":"","seed_keyword":"","intent":"informational|commercial|transactional","keywords":[""],"difficulty":"low|medium|high"}\n  ],\n  "competitor_analysis": [\n    {"name":"","strengths":[""],"weaknesses":[""],"opportunities":[""]}\n  ],\n  "content_gaps": [\n    {"topic":"","why_it_matters":"","suggested_angle":""}\n  ],\n  "quick_wins": [\n    {"action":"","impact":"low|medium|high","effort":"low|medium|high"}\n  ]\n}\n\nGenerate 4-6 keyword clusters, up to 4 competitors, 3-5 content gaps, and 3-5 quick wins.' + _jsonOnly()
    };
  }

  function audit(focus, callback) {
    _resolveHelpers();
    if (!LLMService || !LLMService.isConfigured()) {
      if (callback) callback({ success: false, error: 'No AI providers configured' });
      return;
    }
    var prompt = getAuditPrompt(focus);
    callAIWithRetry(prompt.user, function(rawText) {
      var parsed = parseJSON(rawText);
      if (callback) callback({ success: true, data: parsed });
    }, function(err) {
      if (callback) callback({ success: false, error: err });
    }, 'ai-seo-audit', prompt.system);
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.seo = { audit: audit, getAuditPrompt: getAuditPrompt };
})();
