/**
 * @category    ui
 * @purpose     SEO section view. variable-items mode.
 *              Reads SEO audit output (stored under
 *              W.acceptedSections.seo when the inline audit action
 *              completes). Lists keyword clusters, content gaps,
 *              quick wins. Inline action: Run SEO audit.
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
  function _seo(W) { return (W.acceptedSections && W.acceptedSections.seo) || {}; }

  function renderList(W) {
    var s = _seo(W);
    var active = (W.ui && W.ui.itemId) || null;
    var html = '';

    var clusters = s.keyword_clusters || [];
    if (clusters.length) html += '<div class="bpw-shell-card-divider">Keyword clusters</div>';
    for (var i = 0; i < clusters.length; i++) {
      var kc = clusters[i];
      var id = 'cluster:' + i;
      var cls = active === id ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + cls + '" data-item-id="' + _esc(id) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(kc.cluster || kc.seed_keyword || 'Cluster ' + (i + 1)) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc((kc.keywords || []).slice(0, 5).join(', ')) + (kc.difficulty ? ' · ' + _esc(kc.difficulty) : '') + '</div>';
      html += '</article>';
    }

    var gaps = s.content_gaps || [];
    if (gaps.length) html += '<div class="bpw-shell-card-divider">Content gaps</div>';
    for (var j = 0; j < gaps.length; j++) {
      var g = gaps[j];
      var gid = 'gap:' + j;
      var gcls = active === gid ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + gcls + '" data-item-id="' + _esc(gid) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(g.topic || 'Gap ' + (j + 1)) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(g.why_it_matters || '') + '</div>';
      html += '</article>';
    }

    var quickWins = s.quick_wins || [];
    if (quickWins.length) html += '<div class="bpw-shell-card-divider">Quick wins</div>';
    for (var k = 0; k < quickWins.length; k++) {
      var qw = quickWins[k];
      var qid = 'quickwin:' + k;
      var qcls = active === qid ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + qcls + '" data-item-id="' + _esc(qid) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(qw.action || 'Quick win ' + (k + 1)) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc('Impact: ' + (qw.impact || '?') + ' · Effort: ' + (qw.effort || '?')) + '</div>';
      html += '</article>';
    }

    return html || '<div class="bpw-shell-list-empty">' + _icon('magnifying-glass') + '<p>No SEO audit yet. Click <strong>Run SEO audit</strong> above.</p></div>';
  }

  function renderDetail(W, selectedId) {
    if (!selectedId) return '';
    var s = _seo(W);
    var E = window._bpwEditors;
    var parts = selectedId.split(':');
    var type = parts[0], idx = parseInt(parts[1] || '0', 10);
    if (type === 'cluster') {
      var kc = (s.keyword_clusters || [])[idx];
      if (!kc) return '<div class="bpw-shell-detail-empty">Cluster not found.</div>';
      var base = 'seo.keyword_clusters[' + idx + '].';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(kc.cluster || 'Keyword cluster ' + (idx + 1)) + '</h3>'
        + E.renderText({ label: 'Cluster', path: base + 'cluster', value: kc.cluster })
        + E.renderText({ label: 'Seed keyword', path: base + 'seed_keyword', value: kc.seed_keyword })
        + E.renderText({ label: 'Intent', path: base + 'intent', value: kc.intent, placeholder: 'informational / commercial / navigational' })
        + E.renderText({ label: 'Difficulty', path: base + 'difficulty', value: kc.difficulty, placeholder: 'low / medium / high' })
        + E.renderChips({ label: 'Keywords', path: base + 'keywords', value: kc.keywords, addLabel: 'keyword' })
        + '</div>';
    }
    if (type === 'gap') {
      var g = (s.content_gaps || [])[idx];
      if (!g) return '<div class="bpw-shell-detail-empty">Gap not found.</div>';
      var gbase = 'seo.content_gaps[' + idx + '].';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(g.topic || 'Content gap ' + (idx + 1)) + '</h3>'
        + E.renderText({ label: 'Topic', path: gbase + 'topic', value: g.topic })
        + E.renderTextarea({ label: 'Why it matters', path: gbase + 'why_it_matters', value: g.why_it_matters })
        + E.renderTextarea({ label: 'Suggested angle', path: gbase + 'suggested_angle', value: g.suggested_angle, tall: true })
        + '</div>';
    }
    if (type === 'quickwin') {
      var qw = (s.quick_wins || [])[idx];
      if (!qw) return '<div class="bpw-shell-detail-empty">Quick win not found.</div>';
      var qbase = 'seo.quick_wins[' + idx + '].';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(qw.action || 'Quick win ' + (idx + 1)) + '</h3>'
        + E.renderText({ label: 'Action', path: qbase + 'action', value: qw.action })
        + E.renderText({ label: 'Impact', path: qbase + 'impact', value: qw.impact, placeholder: 'low / medium / high' })
        + E.renderText({ label: 'Effort', path: qbase + 'effort', value: qw.effort, placeholder: 'low / medium / high' })
        + '</div>';
    }
    return '';
  }

  // ── Inline action: Run SEO audit ───────────────────────────────────
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
      if (window._bpwExportSync) window._bpwExportSync.syncAll();
      if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
      if (window._bpwAutoSave) window._bpwAutoSave();
      if (window._bpwAppShell) window._bpwAppShell.render();
      if (window._bpwToast) window._bpwToast('SEO audit complete', 'success');
    });
  });

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.seo = {
    id: 'seo',
    title: 'SEO',
    minLevel: 'growing',
    listMode: 'variable-items',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: [
      { id: 'run-seo-audit', label: 'Run SEO audit', icon: 'sparkles' }
    ]
  };
})();
