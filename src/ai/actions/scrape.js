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

  function _seedContext() {
    var seed = (W && W.seedContext) || {};
    var dumpFn = window._bpwAIHelpers && window._bpwAIHelpers.consolidateSeedDump;
    return {
      name: (seed.name || '').trim(),
      dump: dumpFn ? dumpFn(seed) : (seed.dump || seed.description || '').trim(),
      // Legacy fields kept on the returned shape so any older caller
      // that destructures `description` / `customInstructions` keeps
      // working until the Phase-2 wizard rewrite removes those reads.
      description: (seed.description || '').trim(),
      customInstructions: (seed.customInstructions || '').trim()
    };
  }

  function getPrompt(url, platformType, ctx) {
    ctx = ctx || {};
    var socialHint = platformType === 'website'
      ? '\n\nIMPORTANT: Also extract ALL social media profile links you can find on this website (check header, footer, sidebar, contact page, and meta/og tags). Common patterns: youtube.com/@ or /channel/, instagram.com/, linkedin.com/company/ or /in/, twitter.com/ or x.com/, facebook.com/, tiktok.com/@, plus any Google Business profile links.'
      : '';
    var socialSchema = platformType === 'website'
      ? ',\n  "social_profiles": [\n    {"platform": "youtube|instagram|linkedin|twitter_x|facebook|tiktok|google_business|other", "url": "full profile URL", "handle": "@handle or name"}\n  ]'
      : '';

    var contextLines = [];
    if (ctx.name)               contextLines.push('Brand name: ' + ctx.name);
    if (ctx.dump)               contextLines.push('Brand details (provided by the brand owner):\n' + ctx.dump);
    else if (ctx.description)   contextLines.push('Brand description (provided by the brand owner): ' + ctx.description);
    if (!ctx.dump && ctx.customInstructions) contextLines.push('Custom instructions from the brand owner:\n' + ctx.customInstructions);
    var contextBlock = contextLines.length ? '\n\n--- BRAND CONTEXT (authoritative — anchor your analysis on this) ---\n' + contextLines.join('\n') + '\n--- END BRAND CONTEXT ---' : '';

    var fetchNote = '\n\nIMPORTANT: If your environment cannot actually retrieve this URL (no live web access), DO NOT invent details. Set "fetched" to false and only fill fields that are clearly supported by the BRAND CONTEXT above. Leave the other fields as empty strings or empty arrays. If you can retrieve the URL, set "fetched" to true and extract real data from the page contents.';

    return {
      system: 'You are a brand analyst. When given a URL plus brand-owner context, extract brand-relevant information. Prefer real page contents when you can access the URL; otherwise rely on the brand-owner context. Never fabricate plausible-sounding generic content. Return a structured JSON analysis.' + _langSuffix(),
      user:   'Analyze this ' + platformType + ' URL and extract brand information:\n' + url + contextBlock + socialHint + fetchNote + '\n\nReturn ONLY valid JSON:\n{\n  "fetched": false,\n  "tagline": "",\n  "description": "",\n  "offerings": [""],\n  "target_audience": "",\n  "tone_detected": "",\n  "key_messages": [""],\n  "content_themes": [""],\n  "contact_info": {}' + socialSchema + '\n}' + _jsonOnly()
    };
  }

  function run(url, platformType, callback) {
    _resolveHelpers();
    if (!url || !url.trim()) { if (callback) callback({ status: 'failed', url: url, error: 'No URL' }); return; }
    if (!LLMService || !LLMService.isConfigured()) {
      if (callback) callback({ status: 'failed', url: url, error: 'No AI providers configured' });
      return;
    }
    var prompt = getPrompt(url, platformType || 'website', _seedContext());
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
