/**
 * @category    ui
 * @purpose     Right pane — renders the editor for the currently selected
 *              sub-field or item. Delegates the actual editor HTML to the
 *              view's renderDetail(W, selectedId) — views supply the
 *              field-aware editor for their section.
 *
 *              For inline editing, views can call the legacy renderAISection
 *              (window._bpwRenderAISection) which already handles
 *              accept/manual-edit/redo affordances. Phase 5 will replace
 *              that with a native editor; for now the legacy renderer is
 *              the path of least surprise.
 *
 * @exports     window._bpwDetailPane = { render(W) }
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
    var itemId = W.ui && W.ui.itemId;
    var views = window._bpwUIViews || {};
    var view = views[sectionId];

    var html = '<section class="bpw-shell-detail" aria-label="Detail editor">';

    if (!view) {
      html += '<div class="bpw-shell-detail-empty">' + _icon('flask') + '<h3>View module not loaded</h3><p>Section: ' + _esc(sectionId) + '</p></div>';
      html += '</section>';
      return html;
    }

    var body = '';
    try { body = view.renderDetail ? view.renderDetail(W, itemId) : ''; } catch (e) {
      console.warn('[BPW-ui] renderDetail threw for', sectionId, e);
      body = '<div class="bpw-shell-detail-empty">' + _icon('triangle-exclamation') + '<h3>Failed to render</h3><p>' + _esc(e.message || String(e)) + '</p></div>';
    }
    if (!body) {
      body = '<div class="bpw-shell-detail-empty">' + _icon('hand-pointer') + '<h3>Select an item</h3><p>Pick a card from the list to view or edit it here.</p></div>';
    }

    html += body;
    html += '</section>';
    return html;
  }

  window._bpwDetailPane = { render: render };
})();
