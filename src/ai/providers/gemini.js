/**
 * @category   ai
 * @purpose    Google Gemini provider adapter. Generative Language API v1beta.
 *             Forces JSON response via `responseMimeType` so prompts that ask
 *             for JSON output get a parseable string back.
 * @exports    window._bpwAIProviders.gemini
 * @docs       https://ai.google.dev/api/rest/v1beta/models/generateContent
 */
(function() {
  'use strict';

  var ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent';

  window._bpwAIProviders.gemini = {
    buildRequest: function(prompt, cfg, systemPrompt) {
      var body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: cfg.max_tokens,
          temperature: cfg.temperature !== undefined ? cfg.temperature : 1.0,
          topP: 0.95,
          responseMimeType: 'application/json'
        }
      };
      if (systemPrompt) body.system_instruction = { parts: [{ text: systemPrompt }] };
      return {
        endpoint: ENDPOINT.replace('{MODEL}', cfg.model) + '?key=' + cfg.api_key,
        headers: { 'Content-Type': 'application/json' },
        body: body
      };
    },

    parseResponse: function(data) {
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('');
      }
      return JSON.stringify(data);
    }
  };
})();
