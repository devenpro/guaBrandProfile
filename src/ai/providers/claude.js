/**
 * @category   ai
 * @purpose    Anthropic Claude provider adapter. Messages API.
 * @exports    window._bpwAIProviders.claude
 * @docs       https://docs.anthropic.com/en/api/messages
 */
(function() {
  'use strict';

  var ENDPOINT = 'https://api.anthropic.com/v1/messages';
  var ANTHROPIC_VERSION = '2023-06-01';

  window._bpwAIProviders.claude = {
    buildRequest: function(prompt, cfg, systemPrompt) {
      var body = {
        model: cfg.model,
        max_tokens: cfg.max_tokens,
        messages: [{ role: 'user', content: prompt }]
      };
      if (cfg.temperature !== undefined) body.temperature = cfg.temperature;
      if (systemPrompt) body.system = systemPrompt;
      return {
        endpoint: ENDPOINT,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.api_key,
          'anthropic-version': ANTHROPIC_VERSION
        },
        body: body
      };
    },

    parseResponse: function(data) {
      return data.content
        ? data.content.filter(function(c) { return c.type === 'text'; })
                      .map(function(c) { return c.text; })
                      .join('')
        : '';
    }
  };
})();
