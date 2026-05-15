/**
 * @category    ai
 * @purpose     Inline AI action: generate more audience personas. Thin
 *              alias over audience.generateMorePersonas, exposed on its
 *              own namespace so the Audience view binds against a stable
 *              shape (window._bpwAIActions.personas.generateMore).
 * @exports     window._bpwAIActions.personas = { generateMore }
 */
(function() {
  'use strict';

  function generateMore(customGuidance, callback) {
    var audience = window._bpwAIActions && window._bpwAIActions.audience;
    if (!audience || !audience.generateMorePersonas) {
      if (callback) callback({ success: false, error: 'audience action not registered' });
      return;
    }
    return audience.generateMorePersonas(customGuidance, callback);
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.personas = { generateMore: generateMore };
})();
