/**
 * @category    ui
 * @purpose     Identity section view — v2 page-style layout.
 *
 *              Renders every Identity field inline in a single
 *              scrollable page (mission, vision, values, archetype,
 *              elevator pitch, tagline, positioning) instead of the
 *              v1 list-then-detail pattern. Matches docs/mocks/
 *              identity-page.html. The shell renders single-pane for
 *              any view that declares listMode === 'none'.
 *
 * @exports     window._bpwUIViews.identity
 */
(function() {
  'use strict';

  function _esc(s) { return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s); }
  function _icon(n) {
    return (window._bpwIcon || function(name) {
      if (!name) return '';
      if (name.indexOf('fa-') === 0) return '<i class="' + name + '"></i>';
      return '<i class="fa-solid fa-' + name + '"></i>';
    })(n);
  }
  function _E() { return window._bpwEditors; }

  var FIELDS = [
    { id: 'mission',               label: 'Mission',               type: 'prose' },
    { id: 'vision',                label: 'Vision',                type: 'prose' },
    { id: 'values',                label: 'Values',                type: 'list', itemTemplate: { value: '', description: '' },
      listFields: [
        { key: 'value', label: 'Value', type: 'text', placeholder: 'e.g. Craftsmanship' },
        { key: 'description', label: 'Description', type: 'textarea' }
      ]
    },
    { id: 'brand_archetype',       label: 'Brand archetype',       type: 'text', placeholder: 'e.g. The Creator' },
    { id: 'elevator_pitch',        label: 'Elevator pitch',        type: 'prose' },
    { id: 'tagline',               label: 'Tagline',               type: 'text' },
    { id: 'positioning_statement', label: 'Positioning statement', type: 'prose' }
  ];

  function _identity(W) { return (W.acceptedSections && W.acceptedSections.identity) || {}; }

  function _renderFieldCard(W, field) {
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
    return '<article class="bpw-page-field" data-field-id="' + _esc(field.id) + '">'
      +    '<header class="bpw-page-field-head">'
      +      '<h3 class="bpw-page-field-label">' + _esc(field.label) + '</h3>'
      +      '<button class="bpw-page-field-refine" data-action="refine" data-refine-path="' + _esc(path) + '" type="button" title="Improve with AI">'
      +        _icon('sparkles')
      +      '</button>'
      +    '</header>'
      +    '<div class="bpw-page-field-body">' + editor + '</div>'
      +  '</article>';
  }

  // Legacy list mode is no-op in v2 page-style; section-list is hidden
  // by the shell for views with listMode === 'none'. Kept as a stub so
  // any external caller that still invokes it gets a harmless empty
  // string back.
  function renderList() { return ''; }

  function renderDetail(W) {
    var html = '<section class="bpw-shell-detail bpw-shell-detail--page" aria-label="Identity">';
    html += '<header class="bpw-shell-detail-head">';
    html += '<h1>Identity</h1>';
    html += '<p class="bpw-shell-detail-sub">Mission, vision, values, archetype, positioning. Hover any field for an AI refine button, or edit inline.</p>';
    html += '</header>';
    html += '<div class="bpw-page-fields">';
    for (var i = 0; i < FIELDS.length; i++) {
      html += _renderFieldCard(W, FIELDS[i]);
    }
    html += '</div>';
    html += '</section>';
    return html;
  }

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.identity = {
    id: 'identity',
    title: 'Identity',
    minLevel: 'new',
    listMode: 'none',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
