/**
 * @category   ai
 * @purpose    Groq provider adapter. OpenAI-compatible chat-completions.
 *             Groq's API rejects temperature=0 — coerce to 0.01.
 * @exports    window._bpwAIProviders.groq
 * @docs       https://console.groq.com/docs/api-reference
 */
(function() {
  'use strict';

  var ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

  window._bpwAIProviders.groq = {
    buildRequest: function(prompt, cfg, systemPrompt) {
      var messages = [{ role: 'user', content: prompt }];
      if (systemPrompt) messages = [{ role: 'system', content: systemPrompt }].concat(messages);
      var temperature = cfg.temperature !== undefined ? cfg.temperature : 1.0;
      if (temperature === 0) temperature = 0.01;
      return {
        endpoint: ENDPOINT,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.api_key },
        body: { model: cfg.model, max_tokens: cfg.max_tokens, messages: messages, temperature: temperature }
      };
    },

    parseResponse: function(data) {
      return (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content || ''
        : '';
    }
  };
})();
