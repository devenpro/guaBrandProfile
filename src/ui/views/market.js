/**
 * @category    ui
 * @purpose     Market section view. variable-items mode.
 *              Lists category card + competitors + differentiators
 *              (plus trends/opportunities at Deep level).
 *              Inline action: Find more competitors.
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
  function _mkt(W) { return (W.acceptedSections && W.acceptedSections.market) || {}; }

  function renderList(W) {
    var m = _mkt(W);
    var active = (W.ui && W.ui.itemId) || null;
    var html = '';

    // Category + positioning
    var cCls = active === 'category' ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
    html += '<article class="' + cCls + '" data-item-id="category" role="button" tabindex="0">';
    html += '<div class="bpw-shell-card-title">' + _icon('compass') + ' Category & positioning</div>';
    html += '<div class="bpw-shell-card-snippet">' + (m.category ? _esc(m.category) : '<em class="bpw-shell-detail-value-empty">Not set yet</em>') + '</div>';
    html += '</article>';

    // Competitors
    var competitors = m.competitors || [];
    if (competitors.length) html += '<div class="bpw-shell-card-divider">Competitors</div>';
    for (var i = 0; i < competitors.length; i++) {
      var c = competitors[i];
      var id = 'competitor:' + i;
      var cls = active === id ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + cls + '" data-item-id="' + _esc(id) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(c.name || 'Competitor ' + (i + 1)) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(c.description || c.comparison || '') + '</div>';
      html += '</article>';
    }

    // Differentiators
    var diffs = m.differentiators || [];
    if (diffs.length) html += '<div class="bpw-shell-card-divider">Differentiators</div>';
    for (var j = 0; j < diffs.length; j++) {
      var d = diffs[j];
      var did = 'differentiator:' + j;
      var dcls = active === did ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + dcls + '" data-item-id="' + _esc(did) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(d.point || 'Differentiator ' + (j + 1)) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(d.evidence || '') + '</div>';
      html += '</article>';
    }

    // Deep-only: trends + opportunities surfaces as a single card each.
    if ((m.trends || []).length) {
      var tCls = active === 'trends' ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + tCls + '" data-item-id="trends" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _icon('arrow-trend-up') + ' Trends</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc((m.trends || []).slice(0, 3).join(' · ')) + '</div>';
      html += '</article>';
    }
    if ((m.opportunities || []).length) {
      var oCls = active === 'opportunities' ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + oCls + '" data-item-id="opportunities" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _icon('lightbulb') + ' Opportunities</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc((m.opportunities || []).slice(0, 3).join(' · ')) + '</div>';
      html += '</article>';
    }
    return html;
  }

  function renderDetail(W, selectedId) {
    if (!selectedId) return '';
    var m = _mkt(W);
    var E = window._bpwEditors;

    if (selectedId === 'category') {
      return '<div class="bpw-shell-detail-card">'
        + '<h3>Category & positioning</h3>'
        + E.renderText({ label: 'Market category', path: 'market.category', value: m.category })
        + E.renderTextarea({ label: 'Positioning', path: 'market.positioning', value: m.positioning, tall: true })
        + '</div>';
    }
    if (selectedId === 'trends') {
      return '<div class="bpw-shell-detail-card">'
        + '<h3>Trends</h3>'
        + E.renderChips({ label: 'Trends', path: 'market.trends', value: m.trends || [], addLabel: 'trend' })
        + '</div>';
    }
    if (selectedId === 'opportunities') {
      return '<div class="bpw-shell-detail-card">'
        + '<h3>Opportunities</h3>'
        + E.renderChips({ label: 'Opportunities', path: 'market.opportunities', value: m.opportunities || [], addLabel: 'opportunity' })
        + '</div>';
    }

    var parts = selectedId.split(':');
    var type = parts[0], idx = parseInt(parts[1] || '0', 10);
    if (type === 'competitor') {
      var c = (m.competitors || [])[idx];
      if (!c) return '<div class="bpw-shell-detail-empty">Competitor not found.</div>';
      var base = 'market.competitors[' + idx + '].';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(c.name || 'Competitor ' + (idx + 1)) + '</h3>'
        + E.renderText({ label: 'Name', path: base + 'name', value: c.name })
        + E.renderText({ label: 'URL', path: base + 'url', value: c.url, placeholder: 'https://…' })
        + E.renderTextarea({ label: 'Description', path: base + 'description', value: c.description })
        + E.renderChips({ label: 'Strengths', path: base + 'strengths', value: c.strengths })
        + E.renderChips({ label: 'Weaknesses', path: base + 'weaknesses', value: c.weaknesses })
        + E.renderTextarea({ label: 'How we compare', path: base + 'comparison', value: c.comparison })
        + '</div>';
    }
    if (type === 'differentiator') {
      var d = (m.differentiators || [])[idx];
      if (!d) return '<div class="bpw-shell-detail-empty">Differentiator not found.</div>';
      var dbase = 'market.differentiators[' + idx + '].';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(d.point || 'Differentiator ' + (idx + 1)) + '</h3>'
        + E.renderText({ label: 'Point', path: dbase + 'point', value: d.point })
        + E.renderTextarea({ label: 'Evidence', path: dbase + 'evidence', value: d.evidence })
        + '</div>';
    }
    return '';
  }

  // ── Inline action: Find more competitors ───────────────────────────
  $(document).off('click.bpw-comp-more').on('click.bpw-comp-more', '[data-action="find-more-competitors"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    var action = window._bpwAIActions && window._bpwAIActions.competitors && window._bpwAIActions.competitors.findMore;
    if (!action) { if (window._bpwToast) window._bpwToast('Competitors action not registered', 'error'); return; }
    var $btn = $(this).prop('disabled', true).html(_icon('spinner fa-spin') + ' Finding…');
    action('', function(res) {
      $btn.prop('disabled', false).html(_icon('sparkles') + ' Find more competitors');
      if (!res || !res.success) { if (window._bpwToast) window._bpwToast(res && res.error || 'Failed', 'error'); return; }
      var competitors = (res.data && res.data.competitors) || [];
      W.acceptedSections = W.acceptedSections || {};
      W.acceptedSections.market = W.acceptedSections.market || {};
      W.acceptedSections.market.competitors = (W.acceptedSections.market.competitors || []).concat(competitors);
      if (window._bpwExportSync) window._bpwExportSync.syncAll();
      if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
      if (window._bpwAutoSave) window._bpwAutoSave();
      if (window._bpwAppShell) window._bpwAppShell.render();
      if (window._bpwToast) window._bpwToast('Added ' + competitors.length + ' competitors', 'success');
    });
  });

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.market = {
    id: 'market',
    title: 'Market',
    minLevel: 'growing',
    listMode: 'variable-items',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: [
      { id: 'find-more-competitors', label: 'Find more competitors', icon: 'sparkles' }
    ]
  };
})();
