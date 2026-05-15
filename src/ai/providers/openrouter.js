/**
 * @category   ai
 * @purpose    OpenRouter provider adapter. OpenAI-compatible chat-completions
 *             with extra HTTP-Referer / X-Title headers for app attribution.
 * @exports    window._bpwAIProviders.openrouter
 * @docs       https://openrouter.ai/docs
 */
(function() {
  'use strict';

  var ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

  window._bpwAIProviders.openrouter = {
    buildRequest: function(prompt, cfg, systemPrompt) {
      var messages = [{ role: 'user', content: prompt }];
      if (systemPrompt) messages = [{ role: 'system', content: systemPrompt }].concat(messages);
      return {
        endpoint: ENDPOINT,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.api_key,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Brand Profile Wizard'
        },
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
