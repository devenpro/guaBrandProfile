/**
 * @category   ai
 * @purpose    xAI Grok provider adapter. OpenAI-compatible chat-completions.
 * @exports    window._bpwAIProviders.grok
 * @docs       https://docs.x.ai/api
 */
(function() {
  'use strict';

  var ENDPOINT = 'https://api.x.ai/v1/chat/completions';

  window._bpwAIProviders.grok = {
    buildRequest: function(prompt, cfg, systemPrompt) {
      var messages = [{ role: 'user', content: prompt }];
      if (systemPrompt) messages = [{ role: 'system', content: systemPrompt }].concat(messages);
      return {
        endpoint: ENDPOINT,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.api_key },
        body: {
          model: cfg.model,
          max_tokens: cfg.max_tokens,
          messages: messages,
          temperature: cfg.temperature !== undefined ? cfg.temperature : 1.0
        }
      };
    },

    parseResponse: function(data) {
      return (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content || ''
        : '';
    }
  };
})();
