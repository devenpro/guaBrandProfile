/**
 * @category    ui
 * @purpose     Identity section view. fixed-cards mode.
 *              Sub-fields: mission, vision, values, archetype, pitch.
 *              Editable detail pane (Phase 5).
 * @exports     window._bpwUIViews.identity
 */
(function() {
  'use strict';

  function _esc(s) { return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s); }
  function _E() { return window._bpwEditors; }

  var FIELDS = [
    { id: 'mission',         label: 'Mission',         type: 'textarea', tall: true },
    { id: 'vision',          label: 'Vision',          type: 'textarea', tall: true },
    { id: 'values',          label: 'Values',          type: 'list', itemTemplate: { value: '', description: '' },
      listFields: [
        { key: 'value', label: 'Value', type: 'text', placeholder: 'e.g. Craftsmanship' },
        { key: 'description', label: 'Description', type: 'textarea' }
      ]
    },
    { id: 'brand_archetype', label: 'Brand archetype', type: 'text', placeholder: 'e.g. The Creator' },
    { id: 'elevator_pitch',  label: 'Elevator pitch',  type: 'textarea' },
    { id: 'tagline',         label: 'Tagline',         type: 'text' },
    { id: 'positioning_statement', label: 'Positioning statement', type: 'textarea' }
  ];

  function _identity(W) { return (W.acceptedSections && W.acceptedSections.identity) || {}; }
  function _snippet(v, isList) {
    if (v == null || v === '') return '';
    if (isList && Array.isArray(v)) return v.map(function(x) { return x.value || x.name || x; }).filter(Boolean).join(', ');
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
      var snippet = _snippet(v, f.type === 'list');
      var cls = activeItem === f.id ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + cls + '" data-item-id="' + _esc(f.id) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(f.label) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + (snippet ? _esc(snippet) : '<em class="bpw-shell-detail-value-empty">Not set yet</em>') + '</div>';
      html += '</article>';
    }
    return html;
  }

  function renderDetail(W, selectedId) {
    if (!selectedId) return '';
    var field = null;
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].id === selectedId) { field = FIELDS[i]; break; }
    if (!field) return '';
    var id = _identity(W);
    var path = 'identity.' + field.id;
    var value = id[field.id];
    var E = _E();
    var editor = '';
    if (field.type === 'list') {
      editor = E.renderList({ path: path, value: value || [], fields: field.listFields, itemTemplate: field.itemTemplate, addLabel: 'value' });
    } else {
      editor = E.renderField({ type: field.type, path: path, value: value, tall: field.tall, placeholder: field.placeholder });
    }
    return '<div class="bpw-shell-detail-card">'
      +    '<h3>' + _esc(field.label) + '</h3>'
      +    editor
      +    '</div>';
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
