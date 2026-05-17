/**
 * @category    ui
 * @purpose     App shell rendered after autopilot finishes. Sidebar
 *              (210px) + single full-width page (the active view's
 *              renderDetail). v3 collapsed the legacy 3-pane layout —
 *              every view is now page-style (listMode === 'none').
 *
 *              While active, body.bpw-app-shell-active hides legacy
 *              #bpwApp so this shell is the only post-setup surface.
 *              Defers to setup module if autopilot is open or unfinished.
 *
 * @exports     window._bpwAppShell
 *                = { renderIfReady, render, setActiveSection, setActiveItem,
 *                    state }
 *
 * @depends-on  window._bpwState, window._bpwUIViews,
 *              window._bpwAcceptSection (legacy assembly bridge),
 *              window._bpwSyncAllExportFields, window.jQuery
 */
(function() {
  'use strict';

  var $ = window.jQuery;
  var LOG = '[BPW-ui]';
  var W;
  var _pollCount = 0;

  // ── BOOT ────────────────────────────────────────────────────────────
  // Same quiet-on-non-brand-profile policy as src/setup/bpw-setup.js.
  var _bootTimer = setInterval(function() {
    _pollCount++;
    if (window._bpwState && window._bpwState.initialized) {
      clearInterval(_bootTimer);
      _init();
      return;
    }
    if (_pollCount > 300) {
      clearInterval(_bootTimer);
      var bodyClass = (document.body && document.body.className) || '';
      var looksLikeBP = bodyClass.indexOf('brand-profile') !== -1 || bodyClass.indexOf('brand_profile') !== -1;
      if (looksLikeBP) {
        console.error(LOG, 'App shell never initialised — check legacy boot logs.');
      }
    }
  }, 100);

  function _init() {
    W = window._bpwState;
    W.ui = W.ui || { section: 'dashboard', itemId: null, activityOpen: false };
    _wireEvents();
    renderIfReady();
  }

  // ── PUBLIC API ──────────────────────────────────────────────────────
  function renderIfReady() {
    if (!W) return;
    // Setup still owns the screen?
    if (W.setup && W.setup.open) return;
    // Setup never run AND no accepted content → setup will open itself.
    if (!(W.setup && W.setup.finishedAt) && Object.keys(W.acceptedSections || {}).length === 0) return;
    render();
  }

  function render() {
    if (!W) return;
    $('body').addClass('bpw-app-shell-active');
    var $existing = $('#bpwAppShell');
    var html = _shellHTML();
    if ($existing.length) {
      $existing.html(html);
    } else {
      $('body').append('<div id="bpwAppShell" class="bpw-shell" role="application" aria-label="Brand profile">' + html + '</div>');
    }
  }

  function setActiveSection(id) {
    if (!W) return;
    W.ui = W.ui || {};
    W.ui.section = id;
    W.ui.itemId = null;
    // Remember last non-dashboard page so the dashboard's "Resume editing"
    // pill can deep-link back. _lastOpenedField is set by editor click
    // handlers in views/*.js (Phase 6 polish — for now this gives the
    // dashboard a usable resume target as soon as users navigate away).
    if (id && id !== 'dashboard') {
      W._lastOpenedPage = id;
    }
    render();
  }

  function setActiveItem(itemId) {
    if (!W) return;
    W.ui = W.ui || {};
    W.ui.itemId = itemId;
    if (itemId) W._lastOpenedField = itemId;
    render();
  }

  function state() { return W && W.ui; }

  // ── RENDER ──────────────────────────────────────────────────────────
  function _shellHTML() {
    // v3: every view is page-style. The shell renders topbar + sidebar
    // + the active view's renderDetail (no section-list pane).
    var section = (W.ui && W.ui.section) || 'dashboard';
    var view = (window._bpwUIViews || {})[section];
    var topbar = (window._bpwTopbar && window._bpwTopbar.render && window._bpwTopbar.render(W)) || '';
    var sidebar = (window._bpwSidebar && window._bpwSidebar.render && window._bpwSidebar.render(W)) || '';
    var detail = '';
    if (view && typeof view.renderDetail === 'function') {
      try { detail = view.renderDetail(W) || ''; }
      catch (e) {
        console.error(LOG, 'view renderDetail threw', section, e);
        detail = '<section class="bpw-shell-detail bpw-shell-detail--page"><div class="bpw-shell-detail-empty">Failed to render: ' + (e.message || e) + '</div></section>';
      }
    } else {
      detail = '<section class="bpw-shell-detail bpw-shell-detail--page"><div class="bpw-shell-detail-empty">Unknown section: ' + section + '</div></section>';
    }
    var drawer = (window._bpwActivityDrawer && window._bpwActivityDrawer.render && window._bpwActivityDrawer.render(W)) || '';
    return topbar +
      '<div class="bpw-shell-body bpw-shell-body--single">' +
        sidebar +
        detail +
      '</div>' +
      drawer;
  }

  function _wireEvents() {
    var ns = '.bpw-shell';

    $(document).off('click' + ns, '#bpwAppShell [data-section]')
      .on('click' + ns, '#bpwAppShell [data-section]', function(e) {
        e.preventDefault();
        setActiveSection($(this).data('section'));
      });

    $(document).off('click' + ns, '#bpwAppShell [data-item-id]')
      .on('click' + ns, '#bpwAppShell [data-item-id]', function(e) {
        // Don't fire on input/button clicks inside the item card.
        if ($(e.target).closest('button, input, textarea, a').length) return;
        e.preventDefault();
        setActiveItem($(this).data('item-id'));
      });

    $(document).off('click' + ns, '#bpwAppShell [data-action="open-activity"]')
      .on('click' + ns, '#bpwAppShell [data-action="open-activity"]', function(e) {
        e.preventDefault();
        W.ui.activityOpen = true;
        render();
      });

    $(document).off('click' + ns, '#bpwAppShell [data-action="close-activity"]')
      .on('click' + ns, '#bpwAppShell [data-action="close-activity"]', function(e) {
        e.preventDefault();
        W.ui.activityOpen = false;
        render();
      });

    $(document).off('click' + ns, '#bpwAppShell [data-action="save"]')
      .on('click' + ns, '#bpwAppShell [data-action="save"]', function(e) {
        e.preventDefault();
        if (W._saving) return;
        if (typeof window._bpwSaveProgress !== 'function') {
          console.warn(LOG, 'Save not available — _bpwSaveProgress missing.');
          return;
        }
        W._saving = true;
        render();
        try {
          window._bpwSaveProgress();
        } finally {
          // The Drupal submit reloads the page on success; if we're still
          // here a moment later, just drop the saving flag and re-render.
          setTimeout(function() {
            if (!W) return;
            W._saving = false;
            render();
          }, 1500);
        }
      });

    // Re-render only the topbar when the dirty / last-saved state flips
    // elsewhere (autosave, debounced syncToTextarea). A full shell
    // re-render here would steal focus from any editor the user is
    // typing in, so we surgically replace just the topbar.
    if (!window._bpwAppShell_dirtyHook) {
      window._bpwAppShell_dirtyHook = function() {
        if (!W || !window._bpwTopbar) return;
        var $topbar = $('#bpwAppShell .bpw-shell-topbar');
        if (!$topbar.length) return;
        var html = window._bpwTopbar.render(W);
        // Replace just the topbar in place. The render() output is a
        // <header>…</header> element; swap our existing one with it.
        var $new = $($.parseHTML(html));
        $topbar.replaceWith($new);
      };
    }
  }

  window._bpwAppShell = {
    renderIfReady: renderIfReady,
    render: render,
    setActiveSection: setActiveSection,
    setActiveItem: setActiveItem,
    state: state
  };
})();
