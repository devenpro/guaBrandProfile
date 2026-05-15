/**
 * @category    ui
 * @purpose     Identity section view. fixed-cards mode.
 *              Sub-fields: mission, vision, values, archetype, pitch.
 * @exports     window._bpwUIViews.identity
 */
(function() {
  'use strict';

  function _esc(s) { return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s); }

  var FIELDS = [
    { id: 'mission',         label: 'Mission' },
    { id: 'vision',          label: 'Vision' },
    { id: 'values',          label: 'Values',         isList: true },
    { id: 'brand_archetype', label: 'Brand archetype' },
    { id: 'elevator_pitch',  label: 'Elevator pitch' }
  ];

  function _identity(W) { return (W.acceptedSections && W.acceptedSections.identity) || {}; }
  function _snippet(v, isList) {
    if (v == null || v === '') return '';
    if (isList && Array.isArray(v)) return v.map(function(x) { return x.value || x.name || x; }).join(', ');
    if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return ''; } }
    return String(v);
  }

  function renderList(W) {
    var id = _identity(W);
    var activeItem = (W.ui && W.ui.itemId) || null;
    var html = '';
    for (var i = 0; i < FIELDS.length; i++) {
      var f = FIELDS[i];
      var v = id[f.id];
      var snippet = _snippet(v, f.isList);
      var cls = activeItem === f.id ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + cls + '" data-item-id="' + _esc(f.id) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(f.label) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + (snippet ? _esc(snippet) : '<em class="bpw-shell-detail-value-empty">Not set yet</em>') + '</div>';
      html += '</article>';
    }
    return html;
  }

  function renderDetail(W, selectedId) {
    var id = _identity(W);
    if (!selectedId) return '';
    var field = null;
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].id === selectedId) { field = FIELDS[i]; break; }
    if (!field) return '';
    var value = id[field.id];
    var html = '<div class="bpw-shell-detail-card">';
    html += '<h3>' + _esc(field.label) + '</h3>';
    html += '<div class="bpw-shell-detail-row">';
    html += '<div class="bpw-shell-detail-label">Current value</div>';
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) {
      html += '<div class="bpw-shell-detail-value bpw-shell-detail-value-empty">Not generated yet.</div>';
    } else if (field.isList && Array.isArray(value)) {
      html += '<ul class="bpw-shell-detail-value">';
      for (var j = 0; j < value.length; j++) {
        var v = value[j];
        var name = v.value || v.name || v;
        var desc = v.description || '';
        html += '<li><strong>' + _esc(name) + '</strong>' + (desc ? ' — ' + _esc(desc) : '') + '</li>';
      }
      html += '</ul>';
    } else {
      html += '<div class="bpw-shell-detail-value">' + _esc(typeof value === 'object' ? JSON.stringify(value, null, 2) : value) + '</div>';
    }
    html += '</div></div>';
    return html;
  }

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.identity = {
    id: 'identity',
    title: 'Identity',
    minLevel: 'new',
    listMode: 'fixed-cards',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
