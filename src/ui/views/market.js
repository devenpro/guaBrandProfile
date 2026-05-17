/**
 * @category    ui
 * @purpose     Market section view — v3 page-style layout.
 *
 *              Category + positioning, competitors (with full editor),
 *              differentiators, trends, and opportunities all rendered
 *              inline on one page.
 *
 * @exports     window._bpwUIViews.market
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
  function _mkt(W) { return (W.acceptedSections && W.acceptedSections.market) || {}; }

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

  function _renderCompetitor(c, idx) {
    var base = 'market.competitors[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Name', path: base + 'name', value: c.name })
      + _E().renderText({ label: 'URL', path: base + 'url', value: c.url, placeholder: 'https://…' })
      + _E().renderTextarea({ label: 'Description', path: base + 'description', value: c.description })
      + _E().renderChips({ label: 'Strengths', path: base + 'strengths', value: c.strengths })
      + _E().renderChips({ label: 'Weaknesses', path: base + 'weaknesses', value: c.weaknesses })
      + _E().renderTextarea({ label: 'How we compare', path: base + 'comparison', value: c.comparison });
    return _fieldCard({
      label: c.name || 'Competitor ' + (idx + 1),
      path: 'market.competitors[' + idx + ']',
      body: body,
      removeAction: 'market-remove-competitor',
      removeIdx: idx
    });
  }

  function _renderDifferentiator(d, idx) {
    var base = 'market.differentiators[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Point', path: base + 'point', value: d.point })
      + _E().renderTextarea({ label: 'Evidence', path: base + 'evidence', value: d.evidence });
    return _fieldCard({
      label: d.point || 'Differentiator ' + (idx + 1),
      path: 'market.differentiators[' + idx + ']',
      body: body,
      removeAction: 'market-remove-differentiator',
      removeIdx: idx
    });
  }

  function renderList() { return ''; }

  function renderDetail(W) {
    var m = _mkt(W);
    var competitors = m.competitors || [];
    var diffs = m.differentiators || [];

    var html = '<section class="bpw-shell-detail bpw-shell-detail--page" aria-label="Market">';
    html += '<header class="bpw-shell-detail-head">';
    html += '<h1>Market</h1>';
    html += '<p class="bpw-shell-detail-sub">Category, positioning, competitive landscape, differentiators, trends, and opportunities.</p>';
    html += '</header>';

    html += '<div class="bpw-page-fields">';
    html += _fieldCard({
      label: 'Market category',
      path: 'market.category',
      body: _E().renderText({ path: 'market.category', value: m.category, placeholder: 'e.g. independent design studios' })
    });
    html += _fieldCard({
      label: 'Positioning',
      path: 'market.positioning',
      body: _E().renderField({ type: 'prose', path: 'market.positioning', value: m.positioning })
    });

    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Competitors</h2>';
    html += '<div class="bpw-page-collection-actions">';
    html += '<button class="bpw-page-collection-add" data-action="market-add-competitor" type="button">' + _icon('plus') + ' Add competitor</button>';
    html += '<button class="bpw-page-collection-add bpw-page-collection-add--ai" data-action="find-more-competitors" type="button">' + _icon('sparkles') + ' Find more</button>';
    html += '</div></div>';
    if (!competitors.length) {
      html += '<div class="bpw-page-collection-empty">No competitors yet.</div>';
    } else {
      for (var i = 0; i < competitors.length; i++) html += _renderCompetitor(competitors[i], i);
    }

    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Differentiators</h2>';
    html += '<button class="bpw-page-collection-add" data-action="market-add-differentiator" type="button">' + _icon('plus') + ' Add differentiator</button>';
    html += '</div>';
    if (!diffs.length) {
      html += '<div class="bpw-page-collection-empty">No differentiators yet.</div>';
    } else {
      for (var j = 0; j < diffs.length; j++) html += _renderDifferentiator(diffs[j], j);
    }

    html += _fieldCard({
      label: 'Trends',
      path: 'market.trends',
      body: _E().renderChips({ path: 'market.trends', value: m.trends || [], addLabel: 'trend' })
    });
    html += _fieldCard({
      label: 'Opportunities',
      path: 'market.opportunities',
      body: _E().renderChips({ path: 'market.opportunities', value: m.opportunities || [], addLabel: 'opportunity' })
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

  $(document).off('click.bpw-mkt-add-comp').on('click.bpw-mkt-add-comp', '[data-action="market-add-competitor"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.market = W.acceptedSections.market || {};
    W.acceptedSections.market.competitors = W.acceptedSections.market.competitors || [];
    W.acceptedSections.market.competitors.push({ name: '', url: '', description: '', strengths: [], weaknesses: [], comparison: '' });
    _refresh();
  });

  $(document).off('click.bpw-mkt-rm-comp').on('click.bpw-mkt-rm-comp', '[data-action="market-remove-competitor"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (isNaN(idx)) return;
    var W = window._bpwState;
    var arr = W.acceptedSections && W.acceptedSections.market && W.acceptedSections.market.competitors;
    if (!arr) return;
    arr.splice(idx, 1);
    _refresh();
  });

  $(document).off('click.bpw-mkt-add-diff').on('click.bpw-mkt-add-diff', '[data-action="market-add-differentiator"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.market = W.acceptedSections.market || {};
    W.acceptedSections.market.differentiators = W.acceptedSections.market.differentiators || [];
    W.acceptedSections.market.differentiators.push({ point: '', evidence: '' });
    _refresh();
  });

  $(document).off('click.bpw-mkt-rm-diff').on('click.bpw-mkt-rm-diff', '[data-action="market-remove-differentiator"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (isNaN(idx)) return;
    var W = window._bpwState;
    var arr = W.acceptedSections && W.acceptedSections.market && W.acceptedSections.market.differentiators;
    if (!arr) return;
    arr.splice(idx, 1);
    _refresh();
  });

  // ── Inline action: Find more competitors ─────────────────────────
  $(document).off('click.bpw-comp-more').on('click.bpw-comp-more', '[data-action="find-more-competitors"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    var action = window._bpwAIActions && window._bpwAIActions.competitors && window._bpwAIActions.competitors.findMore;
    if (!action) { if (window._bpwToast) window._bpwToast('Competitors action not registered', 'error'); return; }
    var $btn = $(this).prop('disabled', true).html(_icon('spinner fa-spin') + ' Finding…');
    action('', function(res) {
      $btn.prop('disabled', false).html(_icon('sparkles') + ' Find more');
      if (!res || !res.success) { if (window._bpwToast) window._bpwToast(res && res.error || 'Failed', 'error'); return; }
      var comps = (res.data && res.data.competitors) || [];
      W.acceptedSections = W.acceptedSections || {};
      W.acceptedSections.market = W.acceptedSections.market || {};
      W.acceptedSections.market.competitors = (W.acceptedSections.market.competitors || []).concat(comps);
      _refresh();
      if (window._bpwToast) window._bpwToast('Added ' + comps.length + ' competitors', 'success');
    });
  });

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.market = {
    id: 'market',
    title: 'Market',
    minLevel: 'growing',
    listMode: 'none',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
