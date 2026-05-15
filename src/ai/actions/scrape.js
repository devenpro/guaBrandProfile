/**
 * @category    ai
 * @purpose     AI action: scrape a brand URL (website or social profile)
 *              and extract structured brand context. Used by the setup
 *              autopilot's first stage to seed downstream prompts.
 * @exports     window._bpwAIActions.scrape = { run, getPrompt }
 *
 *              run(url, platformType, callback)
 *                callback({ status: 'success'|'partial'|'failed', url,
 *                           extracted?, error?, analyzed_at })
 *
 * @depends-on  window.LLMService, window._bpwAIHelpers
 *              window._bpwState (for language preference only)
 * @extracted-from  src/legacy/bpw-part2a.js scrapeURL + PROMPTS.scrape
 */
(function() {
  'use strict';

  var W, LLMService, parseJSON, callAIWithRetry;

  function _resolveHelpers() {
    W = window._bpwState;
    LLMService = window.LLMService;
    var H = window._bpwAIHelpers || {};
    parseJSON = H.parseJSON;
    callAIWithRetry = H.callAIWithRetry;
  }

  function _langSuffix() {
    var lang = W && W.language;
    if (!lang || lang === 'en') return '';
    return '\n\nIMPORTANT: Output values in ' + lang + '. JSON keys stay in English.';
  }

  function _jsonOnly() {
    return '\n\nRESPOND WITH VALID JSON ONLY. No markdown, no explanation, no preamble. Just the JSON object.';
  }

  function getPrompt(url, platformType) {
    var socialHint = platformType === 'website'
      ? '\n\nIMPORTANT: Also extract ALL social media profile links you can find on this website (check header, footer, sidebar, contact page, and meta/og tags). Common patterns: youtube.com/@ or /channel/, instagram.com/, linkedin.com/company/ or /in/, twitter.com/ or x.com/, facebook.com/, tiktok.com/@, plus any Google Business profile links.'
      : '';
    var socialSchema = platformType === 'website'
      ? ',\n  "social_profiles": [\n    {"platform": "youtube|instagram|linkedin|twitter_x|facebook|tiktok|google_business|other", "url": "full profile URL", "handle": "@handle or name"}\n  ]'
      : '';
    return {
      system: 'You are a brand analyst with web access. Analyze the given URL and extract brand-relevant information. Return a structured JSON analysis.' + _langSuffix(),
      user:   'Analyze this ' + platformType + ' URL and extract all brand information:\n' + url + socialHint + '\n\nReturn ONLY valid JSON:\n{\n  "tagline": "",\n  "description": "",\n  "offerings": [""],\n  "target_audience": "",\n  "tone_detected": "",\n  "key_messages": [""],\n  "content_themes": [""],\n  "contact_info": {}' + socialSchema + '\n}' + _jsonOnly()
    };
  }

  function run(url, platformType, callback) {
    _resolveHelpers();
    if (!url || !url.trim()) { if (callback) callback({ status: 'failed', url: url, error: 'No URL' }); return; }
    if (!LLMService || !LLMService.isConfigured()) {
      if (callback) callback({ status: 'failed', url: url, error: 'No AI providers configured' });
      return;
    }
    var prompt = getPrompt(url, platformType || 'website');
    callAIWithRetry(prompt.user, function(rawText) {
      var parsed;
      try { parsed = parseJSON(rawText); }
      catch (e) {
        if (callback) callback({ status: 'partial', url: url, extracted: { raw_text: rawText }, analyzed_at: new Date().toISOString() });
        return;
      }
      if (callback) callback({ status: 'success', url: url, extracted: parsed, analyzed_at: new Date().toISOString() });
    }, function(err) {
      if (callback) callback({ status: 'failed', url: url, error: err });
    }, 'ai-scrape', prompt.system);
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.scrape = { run: run, getPrompt: getPrompt };
})();
