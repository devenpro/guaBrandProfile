/**
 * @category    ui
 * @purpose     Offerings section view — v3 page-style layout.
 *
 *              Items, programs, revenue streams, pricing, and content
 *              approach all rendered inline on one scrollable page.
 *
 * @exports     window._bpwUIViews.offerings
 */
(function() {
  'use strict';

  var $ = window.jQuery;

  function _esc(s) { return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s); }
  function _icon(n) {
    return (window._bpwIcon || function(name) {
      if (!name) return '';
      if (name.indexOf('fa-') === 0) return '<i class="' + name + '"></i>';
      return '<i class="fa-solid fa-' + name + '"></i>';
    })(n);
  }
  function _E() { return window._bpwEditors; }
  function _off(W) { return (W.acceptedSections && W.acceptedSections.offerings) || {}; }

  function _fieldCard(opts) {
    var remove = opts.removeAction
      ? '<button class="bpw-page-field-remove" data-action="' + _esc(opts.removeAction) + '" data-idx="' + opts.removeIdx + '" type="button" title="Remove">' + _icon('xmark') + '</button>'
      : '';
    var sparkle = opts.path
      ? '<button class="bpw-page-field-refine" data-action="refine" data-refine-path="' + _esc(opts.path) + '" type="button" title="Improve with AI">' + _icon('sparkles') + '</button>'
      : '';
    return '<article class="bpw-page-field">'
      + '<header class="bpw-page-field-head">'
      +   '<h3 class="bpw-page-field-label">' + _esc(opts.label) + '</h3>'
      +   '<div class="bpw-page-field-head-actions">' + sparkle + remove + '</div>'
      + '</header>'
      + '<div class="bpw-page-field-body">' + opts.body + '</div>'
      + '</article>';
  }

  function _renderItem(item, idx) {
    var base = 'offerings.items[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Name', path: base + 'name', value: item.name })
      + _E().renderText({ label: 'Category', path: base + 'category', value: item.category })
      + _E().renderTextarea({ label: 'Description', path: base + 'description', value: item.description })
      + _E().renderChips({ label: 'Features', path: base + 'features', value: item.features, addLabel: 'feature' })
      + _E().renderChips({ label: 'Benefits', path: base + 'benefits', value: item.benefits, addLabel: 'benefit' })
      + _E().renderText({ label: 'Target audience', path: base + 'target_audience', value: item.target_audience })
      + _E().renderText({ label: 'Status', path: base + 'status', value: item.status, placeholder: 'active / coming soon / sunset' });
    return _fieldCard({
      label: item.name || 'Offering ' + (idx + 1),
      path: 'offerings.items[' + idx + ']',
      body: body,
      removeAction: 'offerings-remove-item',
      removeIdx: idx
    });
  }

  function _renderProgram(prog, idx) {
    var base = 'offerings.programs[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Name', path: base + 'name', value: prog.name })
      + _E().renderText({ label: 'Category', path: base + 'category', value: prog.category })
      + _E().renderTextarea({ label: 'Description', path: base + 'description', value: prog.description })
      + _E().renderChips({ label: 'Features', path: base + 'features', value: prog.features })
      + _E().renderText({ label: 'Target audience', path: base + 'target_audience', value: prog.target_audience });
    return _fieldCard({
      label: prog.name || 'Program ' + (idx + 1),
      path: 'offerings.programs[' + idx + ']',
      body: body,
      removeAction: 'offerings-remove-program',
      removeIdx: idx
    });
  }

  function renderList() { return ''; }

  function renderDetail(W) {
    var o = _off(W);
    var items = o.items || [];
    var programs = o.programs || [];

    var html = '<section class="bpw-shell-detail bpw-shell-detail--page" aria-label="Offerings">';
    html += '<header class="bpw-shell-detail-head">';
    html += '<h1>Offerings</h1>';
    html += '<p class="bpw-shell-detail-sub">Products, services, programs, revenue, pricing, and content approach. Editable inline.</p>';
    html += '</header>';

    html += '<div class="bpw-page-fields">';

    // Offerings collection
    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Offerings</h2>';
    html += '<button class="bpw-page-collection-add" data-action="offerings-add-item" type="button">' + _icon('plus') + ' Add offering</button>';
    html += '</div>';
    if (!items.length) {
      html += '<div class="bpw-page-collection-empty">No offerings yet.</div>';
    } else {
      for (var i = 0; i < items.length; i++) html += _renderItem(items[i], i);
    }

    // Programs collection (nonprofit-flavored).
    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Programs</h2>';
    html += '<button class="bpw-page-collection-add" data-action="offerings-add-program" type="button">' + _icon('plus') + ' Add program</button>';
    html += '</div>';
    if (!programs.length) {
      html += '<div class="bpw-page-collection-empty">No programs yet.</div>';
    } else {
      for (var j = 0; j < programs.length; j++) html += _renderProgram(programs[j], j);
    }

    // Revenue streams (list of { stream, description })
    html += _fieldCard({
      label: 'Revenue streams',
      path: 'offerings.revenue_streams',
      body: _E().renderList({
        path: 'offerings.revenue_streams', value: o.revenue_streams || [],
        addLabel: 'stream',
        itemTemplate: { stream: '', description: '' },
        fields: [
          { key: 'stream', label: 'Stream', type: 'text' },
          { key: 'description', label: 'Description', type: 'textarea' }
        ]
      })
    });

    // Pricing model (prose)
    html += _fieldCard({
      label: 'Pricing model',
      path: 'offerings.pricing_model',
      body: _E().renderField({ type: 'prose', path: 'offerings.pricing_model', value: o.pricing_model })
    });

    // Content approach (prose)
    html += _fieldCard({
      label: 'Content approach',
      path: 'offerings.content_description',
      body: _E().renderField({ type: 'prose', path: 'offerings.content_description', value: o.content_description })
    });

    html += '</div>';
    html += '</section>';
    return html;
  }

  function _refresh() {
    if (window._bpwExportSync) window._bpwExportSync.syncAll();
    if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
    if (window._bpwAutoSave) window._bpwAutoSave();
    if (window._bpwAppShell) window._bpwAppShell.render();
    if (window._bpwSetup && window._bpwSetup.render) window._bpwSetup.render();
  }

  $(document).off('click.bpw-off-add-item').on('click.bpw-off-add-item', '[data-action="offerings-add-item"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.offerings = W.acceptedSections.offerings || {};
    W.acceptedSections.offerings.items = W.acceptedSections.offerings.items || [];
    W.acceptedSections.offerings.items.push({ name: '', category: '', description: '', features: [], benefits: [], target_audience: '', status: 'active' });
    _refresh();
  });

  $(document).off('click.bpw-off-rm-item').on('click.bpw-off-rm-item', '[data-action="offerings-remove-item"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (isNaN(idx)) return;
    var W = window._bpwState;
    var arr = W.acceptedSections && W.acceptedSections.offerings && W.acceptedSections.offerings.items;
    if (!arr) return;
    arr.splice(idx, 1);
    _refresh();
  });

  $(document).off('click.bpw-off-add-prog').on('click.bpw-off-add-prog', '[data-action="offerings-add-program"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.offerings = W.acceptedSections.offerings || {};
    W.acceptedSections.offerings.programs = W.acceptedSections.offerings.programs || [];
    W.acceptedSections.offerings.programs.push({ name: '', category: '', description: '', features: [], target_audience: '' });
    _refresh();
  });

  $(document).off('click.bpw-off-rm-prog').on('click.bpw-off-rm-prog', '[data-action="offerings-remove-program"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (isNaN(idx)) return;
    var W = window._bpwState;
    var arr = W.acceptedSections && W.acceptedSections.offerings && W.acceptedSections.offerings.programs;
    if (!arr) return;
    arr.splice(idx, 1);
    _refresh();
  });

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.offerings = {
    id: 'offerings',
    title: 'Offerings',
    minLevel: 'new',
    listMode: 'none',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
