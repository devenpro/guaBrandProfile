/**
 * @category    ui
 * @purpose     Thin wrapper around the legacy syncAllExportFields so
 *              src/ui/* can trigger an export-field refresh without
 *              reaching directly into window globals every time.
 *              Phase 5 will inline the full extraction; for now this
 *              keeps the surface area clean.
 *
 * @exports     window._bpwExportSync = { syncAll(), syncOne(fieldName) }
 *
 * @depends-on  window._bpwSyncAllExportFields (legacy/bpw-app.js:3536)
 */
(function() {
  'use strict';

  function syncAll() {
    var fn = window._bpwSyncAllExportFields;
    if (typeof fn === 'function') {
      try { fn(); }
      catch (e) { console.warn('[BPW-ui] syncAllExportFields threw', e); }
    }
  }

  function syncOne(/* fieldName */) {
    // Legacy doesn't support per-field sync — fall back to full sync.
    syncAll();
  }

  window._bpwExportSync = { syncAll: syncAll, syncOne: syncOne };
})();
