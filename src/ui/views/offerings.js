/**
 * @category    ui
 * @purpose     Offerings section view. variable-items mode.
 *              Lists items + (creator) content/revenue + (commercial)
 *              pricing + (nonprofit) programs.
 * @exports     window._bpwUIViews.offerings
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
  function _off(W) { return (W.acceptedSections && W.acceptedSections.offerings) || {}; }

  function renderList(W) {
    var o = _off(W);
    var active = (W.ui && W.ui.itemId) || null;
    var html = '';

    var items = o.items || [];
    if (items.length) html += '<div class="bpw-shell-card-divider">Offerings</div>';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var id = 'item:' + i;
      var cls = active === id ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + cls + '" data-item-id="' + _esc(id) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(it.name || 'Item ' + (i + 1)) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(it.description || '') + '</div>';
      html += '</article>';
    }

    var programs = o.programs || [];
    if (programs.length) html += '<div class="bpw-shell-card-divider">Programs</div>';
    for (var j = 0; j < programs.length; j++) {
      var p = programs[j];
      var pid = 'program:' + j;
      var pcls = active === pid ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + pcls + '" data-item-id="' + _esc(pid) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(p.name || 'Program ' + (j + 1)) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(p.description || '') + '</div>';
      html += '</article>';
    }

    var hasRevenue = (o.revenue_streams || []).length;
    if (hasRevenue) {
      var rCls = active === 'revenue' ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + rCls + '" data-item-id="revenue" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _icon('coins') + ' Revenue streams</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc((o.revenue_streams || []).map(function(r) { return r.stream || ''; }).filter(Boolean).join(' · ')) + '</div>';
      html += '</article>';
    }
    if (o.pricing_model) {
      var pmCls = active === 'pricing' ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + pmCls + '" data-item-id="pricing" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _icon('tag') + ' Pricing model</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(o.pricing_model) + '</div>';
      html += '</article>';
    }
    if (o.content_description) {
      var cdCls = active === 'content_desc' ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + cdCls + '" data-item-id="content_desc" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _icon('film') + ' Content approach</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(o.content_description) + '</div>';
      html += '</article>';
    }

    return html || '<div class="bpw-shell-list-empty">' + _icon('box-open') + '<p>No offerings yet — run the autopilot or add manually.</p></div>';
  }

  function _row(label, value, isList) {
    if (value == null || value === '' || (isList && Array.isArray(value) && !value.length)) {
      return '<div class="bpw-shell-detail-row"><div class="bpw-shell-detail-label">' + _esc(label) + '</div><div class="bpw-shell-detail-value bpw-shell-detail-value-empty">—</div></div>';
    }
    if (isList && Array.isArray(value)) {
      var lis = value.map(function(x) { return '<li>' + _esc(typeof x === 'object' ? JSON.stringify(x) : x) + '</li>'; }).join('');
      return '<div class="bpw-shell-detail-row"><div class="bpw-shell-detail-label">' + _esc(label) + '</div><ul class="bpw-shell-detail-value">' + lis + '</ul></div>';
    }
    return '<div class="bpw-shell-detail-row"><div class="bpw-shell-detail-label">' + _esc(label) + '</div><div class="bpw-shell-detail-value">' + _esc(value) + '</div></div>';
  }

  function renderDetail(W, selectedId) {
    if (!selectedId) return '';
    var o = _off(W);
    if (selectedId === 'revenue')      return '<div class="bpw-shell-detail-card"><h3>Revenue streams</h3>' + _row('Streams', o.revenue_streams, true) + '</div>';
    if (selectedId === 'pricing')      return '<div class="bpw-shell-detail-card"><h3>Pricing model</h3>' + _row('Description', o.pricing_model) + '</div>';
    if (selectedId === 'content_desc') return '<div class="bpw-shell-detail-card"><h3>Content approach</h3>' + _row('Description', o.content_description) + '</div>';

    var parts = selectedId.split(':');
    var type = parts[0], idx = parseInt(parts[1] || '0', 10);
    if (type === 'item') {
      var it = (o.items || [])[idx];
      if (!it) return '<div class="bpw-shell-detail-empty">Item not found.</div>';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(it.name || 'Offering') + '</h3>'
        + _row('Category', it.category)
        + _row('Description', it.description)
        + _row('Features', it.features, true)
        + _row('Benefits', it.benefits, true)
        + _row('Target audience', it.target_audience)
        + _row('Status', it.status)
        + '</div>';
    }
    if (type === 'program') {
      var p = (o.programs || [])[idx];
      if (!p) return '<div class="bpw-shell-detail-empty">Program not found.</div>';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(p.name || 'Program') + '</h3>'
        + _row('Category', p.category)
        + _row('Description', p.description)
        + _row('Features', p.features, true)
        + _row('Target audience', p.target_audience)
        + '</div>';
    }
    return '';
  }

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.offerings = {
    id: 'offerings',
    title: 'Offerings',
    minLevel: 'new',
    listMode: 'variable-items',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
