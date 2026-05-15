/**
 * @category    ui
 * @purpose     Three-pane app shell rendered after autopilot finishes.
 *              Sidebar (210px) + section list pane (320px) + detail pane.
 *              While active, body.bpw-app-shell-active hides legacy
 *              #bpwApp so this shell is the only post-setup surface.
 *
 *              Defers to setup module if autopilot is open or unfinished.
 *
 * @exports     window._bpwAppShell
 *                = { renderIfReady, render, setActiveSection, setActiveItem,
 *                    state }
 *
 * @depends-on  window._bpwState, window._bpwUIViews (Phase 4.2),
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
  var _bootTimer = setInterval(function() {
    _pollCount++;
    if (window._bpwState && window._bpwState.initialized) {
      clearInterval(_bootTimer);
      _init();
      return;
    }
    if (_pollCount > 300) {
      clearInterval(_bootTimer);
      console.warn(LOG, 'gave up waiting for Part 1');
    }
  }, 100);

  function _init() {
    W = window._bpwState;
    W.ui = W.ui || { section: 'identity', itemId: null, activityOpen: false };
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
    render();
  }

  function setActiveItem(itemId) {
    if (!W) return;
    W.ui = W.ui || {};
    W.ui.itemId = itemId;
    render();
  }

  function state() { return W && W.ui; }

  // ── RENDER ──────────────────────────────────────────────────────────
  function _shellHTML() {
    var topbar = (window._bpwTopbar && window._bpwTopbar.render && window._bpwTopbar.render(W)) || '';
    var sidebar = (window._bpwSidebar && window._bpwSidebar.render && window._bpwSidebar.render(W)) || '';
    var list = (window._bpwSectionList && window._bpwSectionList.render && window._bpwSectionList.render(W)) || '';
    var detail = (window._bpwDetailPane && window._bpwDetailPane.render && window._bpwDetailPane.render(W)) || '';
    var drawer = (window._bpwActivityDrawer && window._bpwActivityDrawer.render && window._bpwActivityDrawer.render(W)) || '';
    return topbar +
      '<div class="bpw-shell-body">' +
        sidebar +
        list +
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
  }

  window._bpwAppShell = {
    renderIfReady: renderIfReady,
    render: render,
    setActiveSection: setActiveSection,
    setActiveItem: setActiveItem,
    state: state
  };
})();
