/**
 * @category    ai
 * @purpose     Inline AI action: find more competitors. Thin alias over
 *              market.findMoreCompetitors that lets the Market view bind
 *              its button to a stable namespace
 *              (window._bpwAIActions.competitors.findMore).
 * @exports     window._bpwAIActions.competitors = { findMore }
 */
(function() {
  'use strict';

  function findMore(customGuidance, callback) {
    var market = window._bpwAIActions && window._bpwAIActions.market;
    if (!market || !market.findMoreCompetitors) {
      if (callback) callback({ success: false, error: 'market action not registered' });
      return;
    }
    return market.findMoreCompetitors(customGuidance, callback);
  }

  window._bpwAIActions = window._bpwAIActions || {};
  window._bpwAIActions.competitors = { findMore: findMore };
})();
