/**
 * @category    ai
 * @purpose     Bootstrap for the AI-provider registry. Each provider file
 *              registers itself onto `window._bpwAIProviders[<id>]` with the
 *              shape:
 *
 *                buildRequest(prompt, cfg, systemPrompt)
 *                  → { endpoint, headers, body }
 *                parseResponse(data) → string
 *
 *              `cfg` is the resolved selection object from LLMService:
 *                { provider, model, api_key, temperature, max_tokens }
 *
 *              LLMService.callAI looks up the registry instead of carrying
 *              a provider-specific switch statement. New providers ship as
 *              their own files; no changes to LLMService required.
 *
 * @exports     window._bpwAIProviders (initialised to {})
 */
(function() {
  'use strict';
  window._bpwAIProviders = window._bpwAIProviders || {};
})();
