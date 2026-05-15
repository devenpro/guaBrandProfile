/**
 * @category    ai
 * @purpose     Brand context accessor for BPW. Unlike the reference app's
 *              BrandService (which reads brand JSON from Drupal divs to
 *              inform an external content app), BPW IS the brand-creation
 *              app — its source of truth is `W.acceptedSections` plus the
 *              seed/discovery state collected during setup.
 *
 *              Action modules call `getSystemPrompt(contextType)` to inject
 *              already-generated brand context into downstream prompts (so
 *              e.g. the audience prompt sees the brand identity that the
 *              identity prompt produced earlier in the same autopilot run).
 *
 * @exports     window.BrandService
 *                { init, isConfigured, getContext, getSystemPrompt,
 *                  getIdentity, getVoice, getAudience, getOfferings,
 *                  getMarket, getContent }
 *
 * @depends-on  window._bpwState (W)
 * @extracted-from  src/legacy/bpw-app.js buildAIContext (SECTION 24)
 */
(function() {
  'use strict';

  var W;

  function init() {
    W = window._bpwState;
  }

  function _W() { return W || (W = window._bpwState); }

  function isConfigured() {
    var s = _W();
    if (!s) return false;
    var a = s.acceptedSections || {};
    return Object.keys(a).length > 0;
  }

  function getContext() {
    var s = _W() || {};
    return {
      brand_level:    s.brandLevel || '',
      brand_types:    s.brandTypes || [],
      brand_subtypes: s.brandSubtypes || {},
      language:       s.language || 'en',
      seed:           s.seedContext || {},
      imported:       s.importedAssets || {},
      discovery:      s.discoveryAnswers || {},
      accepted:       s.acceptedSections || {}
    };
  }

  function getIdentity() { return ((_W() || {}).acceptedSections || {}).identity || {}; }
  function getVoice()    { return ((_W() || {}).acceptedSections || {}).voice    || {}; }
  function getAudience() { return ((_W() || {}).acceptedSections || {}).audience || {}; }
  function getOfferings(){ return ((_W() || {}).acceptedSections || {}).offerings|| {}; }
  function getMarket()   { return ((_W() || {}).acceptedSections || {}).market   || {}; }
  function getContent()  { return ((_W() || {}).acceptedSections || {}).content_strategy || {}; }

  /**
   * Returns the human-readable brand-types label list,
   * e.g. "Commercial business + Content creator".
   */
  function typeLabels() {
    var s = _W();
    if (!s || !s.brandTypes) return '';
    var BT = (window._bpwConstants && window._bpwConstants.BRAND_TYPES) || {};
    return s.brandTypes.map(function(t) { return (BT[t] || {}).label || t; }).join(' + ');
  }

  /**
   * Long-form context block injected into setup-stage AI prompts.
   * Mirrors the legacy `_contextBlock()` (bpw-part2a.js:127-189) but
   * reads exclusively from W via this service. Includes scraped data,
   * discovery answers, known competitors, and already-accepted sections
   * so each prompt sees the running brand picture.
   */
  function getContextBlock() {
    var ctx = getContext();
    var parts = [];
    parts.push('Brand: ' + ((ctx.seed && ctx.seed.name) || 'Unknown'));
    parts.push('Type: ' + typeLabels());
    parts.push('Level: ' + (ctx.brand_level || 'new'));
    var seed = ctx.seed || {};
    if (seed.description)      parts.push('Description: ' + seed.description);
    if (seed.industry)         parts.push('Industry: ' + seed.industry);
    if (seed.business_model)   parts.push('Business model: ' + seed.business_model);
    if (seed.website_url)      parts.push('Website: ' + seed.website_url);
    if (seed.primary_platform) parts.push('Primary platform: ' + seed.primary_platform);
    if (seed.content_niche)    parts.push('Content niche: ' + seed.content_niche);
    if (seed.cause_area)       parts.push('Cause area: ' + seed.cause_area);

    var web = ctx.imported && ctx.imported.website;
    if (web && web.status === 'success' && web.extracted) {
      var ex = web.extracted;
      parts.push('\n--- Website Analysis (scraped from ' + (web.url || 'website') + ') ---');
      if (ex.tagline)        parts.push('Tagline: ' + ex.tagline);
      if (ex.description)    parts.push('Site description: ' + ex.description);
      if (ex.offerings && ex.offerings.length) parts.push('Offerings on site: ' + ex.offerings.join(', '));
      if (ex.target_audience)parts.push('Target audience: ' + ex.target_audience);
      if (ex.tone_detected)  parts.push('Tone detected: ' + ex.tone_detected);
      if (ex.key_messages && ex.key_messages.length)   parts.push('Key messages: ' + ex.key_messages.join('; '));
      if (ex.content_themes && ex.content_themes.length) parts.push('Content themes: ' + ex.content_themes.join(', '));
    }

    var disc = ctx.discovery;
    if (disc && Object.keys(disc).length) {
      parts.push('\n--- User Discovery Answers ---');
      for (var qid in disc) {
        if (disc.hasOwnProperty(qid)) {
          var a = disc[qid];
          if (a.text)   parts.push(qid + ': ' + a.text);
          if (a.detail) parts.push(qid + ' detail: ' + a.detail);
        }
      }
    }

    if (seed._knownCompetitors && seed._knownCompetitors.length) {
      parts.push('\nKnown competitors: ' + seed._knownCompetitors.filter(Boolean).join(', '));
    }
    if (seed._researchFocus) parts.push('Research focus: ' + seed._researchFocus);

    var acc = ctx.accepted || {};
    if (Object.keys(acc).length) {
      parts.push('\n--- Already Defined Brand Elements ---');
      if (acc.identity && acc.identity.mission) parts.push('Mission: ' + acc.identity.mission);
      if (acc.identity && acc.identity.vision)  parts.push('Vision: ' + acc.identity.vision);
      if (acc.voice && acc.voice.primary_tone)  parts.push('Voice tone: ' + acc.voice.primary_tone);
      if (acc.messaging && acc.messaging.primary_message) parts.push('Primary message: ' + acc.messaging.primary_message);
      if (acc.market && acc.market.positioning) parts.push('Positioning: ' + acc.market.positioning);
    }

    return '\n\nBrand context:\n' + parts.join('\n');
  }

  function getLangSuffix() {
    var s = _W();
    if (!s || !s.language || s.language === 'en') return '';
    var LN = (window._bpwConstants && window._bpwConstants.LANG_NAMES) || {};
    var name = LN[s.language] || s.language;
    return '\n\nIMPORTANT: Generate ALL content in ' + name + '. JSON keys remain in English. Only values should be in ' + name + '.';
  }

  /**
   * Build a short system prompt summarising what's known about the brand
   * so far. `contextType` ('identity'|'voice'|'audience'|'market'|'content'|'seo')
   * lets the caller bias which sections are emphasised first.
   */
  function getSystemPrompt(contextType) {
    var ctx = getContext();
    var parts = [];

    var id = (ctx.accepted && ctx.accepted.identity) || {};
    var voice = (ctx.accepted && ctx.accepted.voice) || {};
    var aud = (ctx.accepted && ctx.accepted.audience) || {};
    var mkt = (ctx.accepted && ctx.accepted.market) || {};
    var off = (ctx.accepted && ctx.accepted.offerings) || {};

    var brandName = id.name || (ctx.seed && ctx.seed.name) || 'this brand';
    parts.push('You are an expert brand strategist helping refine ' + brandName + '. Output must stay consistent with the brand context below.');

    if (id.mission)        parts.push('Mission: ' + id.mission);
    if (id.vision)         parts.push('Vision: ' + id.vision);
    if (id.brand_archetype)parts.push('Archetype: ' + id.brand_archetype);
    if (id.values && id.values.length) {
      parts.push('Values: ' + id.values.map(function(v) { return v.value || v.name || v; }).join('; '));
    }

    if (voice.primary_tone) parts.push('Voice tone: ' + voice.primary_tone);
    if (voice.personality_traits && voice.personality_traits.length) {
      parts.push('Personality: ' + voice.personality_traits.join(', '));
    }
    if (voice.dos && voice.dos.length)     parts.push('DO: ' + voice.dos.slice(0, 5).join('; '));
    if (voice.donts && voice.donts.length) parts.push("DON'T: " + voice.donts.slice(0, 5).join('; '));

    if (aud.primary_description) parts.push('Primary audience: ' + aud.primary_description);

    if (contextType === 'market' || contextType === 'content' || contextType === 'seo') {
      if (mkt.category)    parts.push('Market category: ' + mkt.category);
      if (mkt.positioning) parts.push('Positioning: ' + mkt.positioning);
    }

    if (contextType === 'offerings' || contextType === 'market') {
      if (off.items && off.items.length) {
        parts.push('Offerings: ' + off.items.map(function(o) { return o.name || o.title || o; }).join('; '));
      }
    }

    if (ctx.brand_level) parts.push('Growth phase: ' + ctx.brand_level);
    if (ctx.brand_types && ctx.brand_types.length) parts.push('Brand types: ' + ctx.brand_types.join(', '));
    if (ctx.language && ctx.language !== 'en') parts.push('Output language: ' + ctx.language + ' (JSON keys stay in English; only values are translated).');

    return parts.join('\n');
  }

  window.BrandService = {
    init: init,
    isConfigured: isConfigured,
    getContext: getContext,
    getSystemPrompt: getSystemPrompt,
    getContextBlock: getContextBlock,
    getLangSuffix: getLangSuffix,
    typeLabels: typeLabels,
    getIdentity: getIdentity,
    getVoice: getVoice,
    getAudience: getAudience,
    getOfferings: getOfferings,
    getMarket: getMarket,
    getContent: getContent
  };
})();
