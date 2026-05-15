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
    getIdentity: getIdentity,
    getVoice: getVoice,
    getAudience: getAudience,
    getOfferings: getOfferings,
    getMarket: getMarket,
    getContent: getContent
  };
})();
