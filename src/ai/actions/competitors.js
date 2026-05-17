/**
 * @category    ai
 * @purpose     AI action: dedicated competitor research stage. v2 wizard
 *              runs this as its own per-stage review screen (Step 8 in
 *              the mocks), separate from the broader Market analysis.
 *
 *              Output shape mirrors what market.run() previously
 *              produced for competitors so the Market view and existing
 *              schema slots accept it without changes — the only
 *              difference is that this action focuses solely on
 *              competitors and is depth-tuned per growth phase via
 *              phaseGuidance.
 *
 * @exports     window._bpwAIActions.competitors = { run, getPrompt, findMore }
 *
 *                run(callback) -> callback({ success, data?, error? })
 *                  On success, `data` contains:
 *                    { competitors: [{ name, description, url,
 *                                      strengths[], weaknesses[],
 *                                      comparison }] }
 *
 *                findMore(customGuidance, callback)
 *                  Delegates to market.findMoreCompetitors so existing
 *                  Market-view bindings keep working.
 *
 * @depends-on  window.LLMService, window.BrandService, window._bpwAIHelpers
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

  function _jsonOnly() {
    return '\n\nRESPOND WITH VALID JSON ONLY. No markdown, no preamble.';
  }

  function getPrompt() {
    _resolveHelpers();
    var typeDesc = BrandService.typeLabels();
    var ctx = BrandService.getContextBlock('competitors');
    var lang = BrandService.getLangSuffix();
    return {
      system: 'You are a competitive intelligence analyst researching the competitive landscape for a ' + typeDesc + ' brand. Focus exclusively on competitors — do not propose positioning or differentiators here, the Market stage already covers those.' + lang,
      user:   'Research competitors for this brand. Use the brand context and phase guidance to choose how many cards and how much depth.' + ctx +
              '\n\nFIELD REQUIREMENTS:'
              + '\n- Every competitor MUST include: name, url (full URL — no placeholders), description (1 line), strengths (>= 2), weaknesses (>= 2), comparison (1-2 sentences on how this brand differs).'
              + '\n- Prefer real, identifiable competitors over generic categories. If the brand mentions specific competitor names in the dump, include those by name first.'
              + '\n\nReturn ONLY valid JSON:\n{\n  "competitors": [\n    {"name":"","description":"","url":"","strengths":[""],"weaknesses":[""],"comparison":""}\n  ]\n}' + _jsonOnly()
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
      // Normalise to the same shape market.run() produces under the
      // market_competitors key so downstream code can write into the
      // same schema slot without branching.
      var competitors = parsed.competitors || parsed.market_competitors || [];
      if (callback) callback({ success: true, data: { competitors: competitors } });
    }, function(err) {
      if (callback) callback({ success: false, error: err });
    }, 'ai-competitors', prompt.system);
  }

  function findMore(customGuidance, callback) {
    var market = window._bpwAIActions && window._bpwAIActions.market;
    if (!market || !market.findMoreCompetitors) {
      if (callback) callback({ success: false, error: 'market action not registered' });
      return;
    }
    return market.findMoreCompetitors(customGuidance, callback);
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.competitors = {
    run: run,
    getPrompt: getPrompt,
    findMore: findMore
  };
})();
