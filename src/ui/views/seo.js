/**
 * @category    ui
 * @purpose     SEO section view — v3 page-style layout.
 *
 *              Keyword clusters, content gaps, and quick wins all
 *              inline on one scrollable page. Run-SEO-audit action
 *              preserved at the top.
 *
 * @exports     window._bpwUIViews.seo
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
  function _seo(W) { return (W.acceptedSections && W.acceptedSections.seo) || {}; }

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

  function _renderCluster(kc, idx) {
    var base = 'seo.keyword_clusters[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Cluster', path: base + 'cluster', value: kc.cluster })
      + _E().renderText({ label: 'Seed keyword', path: base + 'seed_keyword', value: kc.seed_keyword })
      + _E().renderText({ label: 'Intent', path: base + 'intent', value: kc.intent, placeholder: 'informational / commercial / navigational' })
      + _E().renderText({ label: 'Difficulty', path: base + 'difficulty', value: kc.difficulty, placeholder: 'low / medium / high' })
      + _E().renderChips({ label: 'Keywords', path: base + 'keywords', value: kc.keywords, addLabel: 'keyword' });
    return _fieldCard({
      label: kc.cluster || 'Keyword cluster ' + (idx + 1),
      path: 'seo.keyword_clusters[' + idx + ']',
      body: body,
      removeAction: 'seo-remove-cluster',
      removeIdx: idx
    });
  }

  function _renderGap(g, idx) {
    var base = 'seo.content_gaps[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Topic', path: base + 'topic', value: g.topic })
      + _E().renderTextarea({ label: 'Why it matters', path: base + 'why_it_matters', value: g.why_it_matters })
      + _E().renderField({ type: 'prose', label: 'Suggested angle', path: base + 'suggested_angle', value: g.suggested_angle });
    return _fieldCard({
      label: g.topic || 'Content gap ' + (idx + 1),
      path: 'seo.content_gaps[' + idx + ']',
      body: body,
      removeAction: 'seo-remove-gap',
      removeIdx: idx
    });
  }

  function _renderQuickWin(qw, idx) {
    var base = 'seo.quick_wins[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Action', path: base + 'action', value: qw.action })
      + _E().renderText({ label: 'Impact', path: base + 'impact', value: qw.impact, placeholder: 'low / medium / high' })
      + _E().renderText({ label: 'Effort', path: base + 'effort', value: qw.effort, placeholder: 'low / medium / high' });
    return _fieldCard({
      label: qw.action || 'Quick win ' + (idx + 1),
      path: 'seo.quick_wins[' + idx + ']',
      body: body,
      removeAction: 'seo-remove-quickwin',
      removeIdx: idx
    });
  }

  function renderList() { return ''; }

  function renderDetail(W) {
    var s = _seo(W);
    var clusters = s.keyword_clusters || [];
    var gaps = s.content_gaps || [];
    var wins = s.quick_wins || [];

    var html = '<section class="bpw-shell-detail bpw-shell-detail--page" aria-label="SEO">';
    html += '<header class="bpw-shell-detail-head">';
    html += '<h1>SEO</h1>';
    html += '<p class="bpw-shell-detail-sub">Keyword clusters, content gaps, and quick wins.</p>';
    html += '<button class="bpw-page-collection-add bpw-page-collection-add--ai" data-action="run-seo-audit" type="button">' + _icon('sparkles') + ' Run SEO audit</button>';
    html += '</header>';

    html += '<div class="bpw-page-fields">';

    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Keyword clusters</h2>';
    html += '<button class="bpw-page-collection-add" data-action="seo-add-cluster" type="button">' + _icon('plus') + ' Add cluster</button>';
    html += '</div>';
    if (!clusters.length) html += '<div class="bpw-page-collection-empty">No clusters yet. Run an audit to populate.</div>';
    else for (var i = 0; i < clusters.length; i++) html += _renderCluster(clusters[i], i);

    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Content gaps</h2>';
    html += '<button class="bpw-page-collection-add" data-action="seo-add-gap" type="button">' + _icon('plus') + ' Add gap</button>';
    html += '</div>';
    if (!gaps.length) html += '<div class="bpw-page-collection-empty">No gaps yet.</div>';
    else for (var j = 0; j < gaps.length; j++) html += _renderGap(gaps[j], j);

    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Quick wins</h2>';
    html += '<button class="bpw-page-collection-add" data-action="seo-add-quickwin" type="button">' + _icon('plus') + ' Add quick win</button>';
    html += '</div>';
    if (!wins.length) html += '<div class="bpw-page-collection-empty">No quick wins yet.</div>';
    else for (var k = 0; k < wins.length; k++) html += _renderQuickWin(wins[k], k);

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

  function _ensureSeo() {
    var W = window._bpwState;
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.seo = W.acceptedSections.seo || {};
    return W.acceptedSections.seo;
  }
  function _removeAt(arrPath, idx) {
    var W = window._bpwState;
    var seo = (W.acceptedSections || {}).seo || {};
    var arr = seo[arrPath];
    if (!Array.isArray(arr)) return;
    arr.splice(idx, 1);
    _refresh();
  }

  $(document).off('click.bpw-seo-add-cluster').on('click.bpw-seo-add-cluster', '[data-action="seo-add-cluster"]', function(e) {
    e.preventDefault();
    var seo = _ensureSeo();
    seo.keyword_clusters = seo.keyword_clusters || [];
    seo.keyword_clusters.push({ cluster: '', seed_keyword: '', intent: '', difficulty: '', keywords: [] });
    _refresh();
  });
  $(document).off('click.bpw-seo-rm-cluster').on('click.bpw-seo-rm-cluster', '[data-action="seo-remove-cluster"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (!isNaN(idx)) _removeAt('keyword_clusters', idx);
  });
  $(document).off('click.bpw-seo-add-gap').on('click.bpw-seo-add-gap', '[data-action="seo-add-gap"]', function(e) {
    e.preventDefault();
    var seo = _ensureSeo();
    seo.content_gaps = seo.content_gaps || [];
    seo.content_gaps.push({ topic: '', why_it_matters: '', suggested_angle: '' });
    _refresh();
  });
  $(document).off('click.bpw-seo-rm-gap').on('click.bpw-seo-rm-gap', '[data-action="seo-remove-gap"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (!isNaN(idx)) _removeAt('content_gaps', idx);
  });
  $(document).off('click.bpw-seo-add-qw').on('click.bpw-seo-add-qw', '[data-action="seo-add-quickwin"]', function(e) {
    e.preventDefault();
    var seo = _ensureSeo();
    seo.quick_wins = seo.quick_wins || [];
    seo.quick_wins.push({ action: '', impact: '', effort: '' });
    _refresh();
  });
  $(document).off('click.bpw-seo-rm-qw').on('click.bpw-seo-rm-qw', '[data-action="seo-remove-quickwin"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (!isNaN(idx)) _removeAt('quick_wins', idx);
  });

  // ── Inline action: Run SEO audit ─────────────────────────────────
  $(document).off('click.bpw-seo-audit').on('click.bpw-seo-audit', '[data-action="run-seo-audit"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    var action = window._bpwAIActions && window._bpwAIActions.seo && window._bpwAIActions.seo.audit;
    if (!action) { if (window._bpwToast) window._bpwToast('SEO audit action not registered', 'error'); return; }
    var $btn = $(this).prop('disabled', true).html(_icon('spinner fa-spin') + ' Auditing…');
    action('', function(res) {
      $btn.prop('disabled', false).html(_icon('sparkles') + ' Run SEO audit');
      if (!res || !res.success) { if (window._bpwToast) window._bpwToast(res && res.error || 'Failed', 'error'); return; }
      W.acceptedSections = W.acceptedSections || {};
      W.acceptedSections.seo = res.data || {};
      _refresh();
      if (window._bpwToast) window._bpwToast('SEO audit complete', 'success');
    });
  });

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.seo = {
    id: 'seo',
    title: 'SEO',
    minLevel: 'growing',
    listMode: 'none',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
