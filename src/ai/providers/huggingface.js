/**
 * @category   ai
 * @purpose    Hugging Face Inference Router adapter. OpenAI-compatible
 *             chat-completions across hosted models.
 * @exports    window._bpwAIProviders.huggingface
 * @docs       https://huggingface.co/docs/inference-providers
 */
(function() {
  'use strict';

  var ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';

  window._bpwAIProviders.huggingface = {
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
