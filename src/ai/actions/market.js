/**
 * @category    ai
 * @purpose     AI action: market analysis (category, positioning, competitors,
 *              differentiators, optional trends/opportunities at deep phase).
 *              Also exposes `findMoreCompetitors` as a post-setup inline
 *              action surfaced in the Market view.
 * @exports     window._bpwAIActions.market = { run, getPrompt,
 *                                              findMoreCompetitors }
 *
 *              run(callback)
 *                callback({ success, data?, error? })
 *                On success, `data` contains flat keys
 *                (market_category, market_positioning, market_competitors,
 *                 market_differentiators, market_trends?, market_opportunities?).
 *                The orchestrator (Phase 3) or view writes these into
 *                W.generatedSections and triggers the accept flow.
 *
 *              findMoreCompetitors(customGuidance, callback)
 *                callback({ success, data?: { competitors }, error? })
 *                Returns ONLY new competitors (caller appends to
 *                W.acceptedSections.market.competitors).
 *
 * @depends-on  window.LLMService, window.BrandService, window._bpwAIHelpers
 * @extracted-from  src/legacy/bpw-part2a.js PROMPTS.market (lines 210-216)
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

  function _isDeep() { return W && W.brandLevel === 'deep'; }
  function _jsonOnly() { return '\n\nRESPOND WITH VALID JSON ONLY. No markdown, no preamble.'; }

  function getPrompt() {
    var depth = _isDeep() ? 'comprehensive' : 'brief';
    var typeDesc = BrandService.typeLabels();
    var ctx = BrandService.getContextBlock();
    var lang = BrandService.getLangSuffix();
    var deepKeys = _isDeep()
      ? ',\n  "market_trends": ["string"],\n  "market_opportunities": ["string"]'
      : '';
    var fieldReqs = '\n\nFIELD REQUIREMENTS:\n'
      + '- Every competitor MUST include: name, url (full URL — no placeholders), strengths (>= 2), weaknesses (>= 2), comparison (1-2 sentences on how the brand differs)\n'
      + '- Every differentiator MUST include: point (short claim) AND evidence (concrete proof)\n'
      + '- 3-5 competitors total, 3-5 differentiators total';
    return {
      system: 'You are an expert market research analyst. Conduct ' + depth + ' market analysis for a ' + typeDesc + ' brand.' + lang,
      user:   'Based on this brand context, generate a market analysis.' + ctx +
              '\n\nReturn ONLY valid JSON:\n{\n  "market_category": "string — the market/industry category",\n  "market_positioning": "string — 2-3 sentence positioning statement",\n  "market_competitors": [\n    {"name":"","description":"","url":"","strengths":[""],"weaknesses":[""],"comparison":""}\n  ],\n  "market_differentiators": [\n    {"point":"","evidence":""}\n  ]' + deepKeys + '\n}' + fieldReqs + _jsonOnly()
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
    }, 'ai-market', prompt.system);
  }

  function findMoreCompetitors(customGuidance, callback) {
    _resolveHelpers();
    if (!LLMService || !LLMService.isConfigured()) {
      if (callback) callback({ success: false, error: 'No AI providers configured' });
      return;
    }
    var existing = (BrandService.getMarket().competitors || []).map(function(c) { return c.name || ''; }).filter(Boolean);
    var guidance = customGuidance ? '\n\nUser direction: ' + customGuidance : '';
    var prompt = {
      system: 'You are a competitive intelligence analyst. Find competitors not already in the brand profile.' + BrandService.getLangSuffix(),
      user:   'Find 3-5 additional competitors for this brand.' + BrandService.getContextBlock() +
              (existing.length ? '\n\nDO NOT repeat these already-tracked competitors: ' + existing.join(', ') : '') +
              guidance +
              '\n\nReturn ONLY valid JSON:\n{\n  "competitors": [\n    {"name":"","description":"","url":"","strengths":[""],"weaknesses":[""],"comparison":""}\n  ]\n}' + _jsonOnly()
    };
    callAIWithRetry(prompt.user, function(rawText) {
      var parsed = parseJSON(rawText);
      if (callback) callback({ success: true, data: { competitors: parsed.competitors || [] } });
    }, function(err) {
      if (callback) callback({ success: false, error: err });
    }, 'ai-find-more-competitors', prompt.system);
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.market = {
    run: run,
    getPrompt: getPrompt,
    findMoreCompetitors: findMoreCompetitors
  };
})();
