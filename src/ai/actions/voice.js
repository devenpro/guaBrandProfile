/**
 * @category    ai
 * @purpose     AI action: brand voice + messaging framework. Also exposes
 *              `voicePreview(format)` for the post-setup voice view to
 *              show short sample copy ("tweet in your voice", etc.).
 * @exports     window._bpwAIActions.voice = { run, getPrompt, voicePreview }
 * @depends-on  window.LLMService, window.BrandService, window._bpwAIHelpers
 * @extracted-from  src/legacy/bpw-part2a.js PROMPTS.voice + PROMPTS.voicePreview
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
    return {
      system: 'You are an expert brand voice strategist. Define the complete voice, tone, and messaging framework for a ' + typeDesc + ' brand.' + BrandService.getLangSuffix(),
      user:   'Generate voice and messaging framework.' + BrandService.getContextBlock('voice') +
              '\n\nReturn ONLY valid JSON:\n{\n  "voice_tone": "primary tone description — 2-3 sentences",\n  "voice_personality": ["trait1", "trait2", "trait3", "trait4", "trait5"],\n  "voice_dos": ["rule1", "rule2", "rule3", "rule4", "rule5"],\n  "voice_donts": ["rule1", "rule2", "rule3", "rule4", "rule5"],\n  "voice_preferred": ["term1", "term2", "term3"],\n  "voice_avoided": ["term1", "term2", "term3"],\n  "messaging_primary": "primary brand message — one powerful sentence",\n  "messaging_supporting": ["supporting message 1", "supporting message 2", "supporting message 3"],\n  "messaging_headlines": [\n    {"context":"landing page","headline":""},\n    {"context":"social media bio","headline":""},\n    {"context":"email subject","headline":""}\n  ],\n  "voice_sample": "A 3-4 sentence sample text written IN the brand voice — a product announcement or content piece"\n}' + _jsonOnly()
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
    }, 'ai-voice', prompt.system);
  }

  function voicePreview(format, callback) {
    _resolveHelpers();
    if (!LLMService || !LLMService.isConfigured()) {
      if (callback) callback({ success: false, error: 'No AI providers configured' });
      return;
    }
    var formatDesc = {
      tweet:  'a tweet (max 280 characters)',
      email:  'an email introduction paragraph',
      video:  'a YouTube video opening script (first 30 seconds)',
      review: 'a reply to a positive customer review',
      blog:   'a blog post opening paragraph',
      custom: 'a short content piece'
    };
    var prompt = {
      system: 'You are a brand copywriter. Write content in the exact voice and tone defined for this brand. Match the personality, vocabulary, and style rules precisely.' + BrandService.getLangSuffix(),
      user:   'Write ' + (formatDesc[format] || formatDesc.custom) + ' for this brand.' + BrandService.getContextBlock('voice') +
              '\n\nReturn ONLY the text content. No JSON wrapper, no quotes, no explanation. Just the raw text in brand voice.'
    };
    // Voice preview returns raw text, not JSON — call LLMService directly so
    // callAIWithRetry's JSON retry doesn't fire.
    LLMService.callAI(prompt.user, function(rawText) {
      var clean = rawText.replace(/```[a-z]*\s*/gi, '').replace(/```\s*/gi, '').trim();
      if ((clean.charAt(0) === '"' && clean.charAt(clean.length - 1) === '"') ||
          (clean.charAt(0) === "'" && clean.charAt(clean.length - 1) === "'")) {
        clean = clean.substring(1, clean.length - 1);
      }
      if (callback) callback({ success: true, text: clean });
    }, function(err) {
      if (callback) callback({ success: false, error: err });
    }, prompt.system);
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.voice = { run: run, getPrompt: getPrompt, voicePreview: voicePreview };
})();
