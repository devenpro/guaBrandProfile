/**
 * @category    ui
 * @purpose     320px middle pane — lists sub-items within the active
 *              section. Two modes:
 *                'fixed-cards'   — one card per sub-field (Identity,
 *                                  Voice, Settings). Card click selects
 *                                  the sub-field for editing in the
 *                                  detail pane.
 *                'variable-items'— a list of items (segments, personas,
 *                                  competitors, etc.). Includes the
 *                                  view's inline AI action buttons at
 *                                  the top ("Generate more personas").
 *
 *              Renders an empty state if the section has no data yet
 *              with a CTA to run the relevant AI action.
 *
 * @exports     window._bpwSectionList = { render(W) }
 *
 * @depends-on  window._bpwUIViews[<id>] — supplies the renderList(W) fn.
 */
(function() {
  'use strict';

  function _esc(s) {
    return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s);
  }
  function _icon(n) {
    return (window._bpwIcon || function(name) {
      if (!name) return '';
      if (name.indexOf('fa-') === 0) return '<i class="' + name + '"></i>';
      return '<i class="fa-solid fa-' + name + '"></i>';
    })(n);
  }

  function render(W) {
    var sectionId = (W.ui && W.ui.section) || 'identity';
    var views = window._bpwUIViews || {};
    var view = views[sectionId];

    var html = '<section class="bpw-shell-list" aria-label="Section items">';
    html += '<header class="bpw-shell-list-header"><h2>' + _esc(view ? view.title : sectionId) + '</h2></header>';

    if (!view) {
      html += '<div class="bpw-shell-list-empty">' + _icon('flask') + '<p>View module not loaded.</p></div>';
      html += '</section>';
      return html;
    }

    if (view.inlineActions && view.inlineActions.length) {
      html += '<div class="bpw-shell-list-actions">';
      for (var i = 0; i < view.inlineActions.length; i++) {
        var a = view.inlineActions[i];
        // "add-row" actions append an empty item to a list path and
        // select the new row. Distinct from AI inline actions which
        // own their own click handlers via [data-action="<id>"].
        if (a.type === 'add-row') {
          html += '<button class="bpw-shell-action-btn" data-action="bpw-section-add-row" data-list-path="' + _esc(a.listPath) + '" data-item-template=\'' + _esc(JSON.stringify(a.itemTemplate || {})) + '\' data-item-prefix="' + _esc(a.itemPrefix || '') + '" type="button">' + _icon(a.icon || 'plus') + ' ' + _esc(a.label) + '</button>';
        } else {
          html += '<button class="bpw-shell-action-btn" data-action="' + _esc(a.id) + '" type="button">' + _icon(a.icon || 'sparkles') + ' ' + _esc(a.label) + '</button>';
        }
      }
      html += '</div>';
    }

    var body = '';
    try { body = view.renderList ? view.renderList(W) : ''; } catch (e) {
      console.warn('[BPW-ui] renderList threw for', sectionId, e);
      body = '<div class="bpw-shell-list-empty">' + _icon('triangle-exclamation') + '<p>Failed to render list.</p></div>';
    }
    html += '<div class="bpw-shell-list-body">' + body + '</div>';
    html += '</section>';
    return html;
  }

  // ── Generic "Add row" handler ─────────────────────────────────────
  // Triggered by inline actions of type "add-row". Appends a deep
  // clone of itemTemplate to the list at listPath, then selects the
  // new item so the detail pane focuses on it for editing.
  if (window.jQuery) {
    var $ = window.jQuery;
    $(document).off('click.bpw-section-add-row').on('click.bpw-section-add-row', '[data-action="bpw-section-add-row"]', function(e) {
      e.preventDefault();
      var path = $(this).attr('data-list-path');
      var prefix = $(this).attr('data-item-prefix') || '';
      if (!path) return;
      var tmpl = {};
      try { tmpl = JSON.parse($(this).attr('data-item-template') || '{}'); } catch (err) {}
      var store = window._bpwPathStore;
      if (!store) return;
      var arr = store.get(path) || [];
      var idx = arr.length;
      store.push(path, JSON.parse(JSON.stringify(tmpl)));
      store.persist();
      // Select the new row, then re-render.
      if (window._bpwAppShell && prefix) {
        window._bpwAppShell.setActiveItem(prefix + ':' + idx);
      } else if (window._bpwAppShell) {
        window._bpwAppShell.render();
      }
    });
  }

  window._bpwSectionList = { render: render };
})();
