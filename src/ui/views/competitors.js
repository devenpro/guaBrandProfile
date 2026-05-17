/**
 * @category    ui
 * @purpose     Competitors view — surfaces the competitor cards that
 *              the Market section already stores in
 *              W.acceptedSections.market.competitors as their own
 *              top-level navigation item.
 *
 *              v2 elevates competitors out of the buried Market sub-list
 *              into a first-class section with its own page. Data lives
 *              under market.competitors (no schema change) so the Market
 *              view's competitor editor and this view stay in sync.
 *
 * @exports     window._bpwUIViews.competitors = { renderList, renderDetail }
 *
 * @depends-on  window._bpwState, window.BrandService, window._bpwIcon
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

  function _competitors(W) {
    var market = ((W.acceptedSections || {}).market) || {};
    return Array.isArray(market.competitors) ? market.competitors : [];
  }

  function renderList(W) {
    var comps = _competitors(W);
    var html = '<aside class="bpw-shell-list" aria-label="Competitors list">';
    html += '<header class="bpw-shell-list-head"><h3>Competitors</h3>'
         + '<button class="bpw-shell-list-action" data-action="ai-find-more-competitors" type="button">'
         + _icon('plus') + ' Find more</button></header>';
    if (!comps.length) {
      html += '<div class="bpw-shell-list-empty">' + _icon('crosshairs') + '<p>No competitors yet.</p>'
           + '<button class="bpw-btn bpw-btn-primary" data-action="ai-find-more-competitors" type="button">'
           + _icon('sparkles') + ' Research competitors</button></div>';
    } else {
      html += '<ul class="bpw-shell-list-items">';
      for (var i = 0; i < comps.length; i++) {
        var c = comps[i] || {};
        html += '<li class="bpw-shell-list-item" data-item-id="' + _esc('comp-' + i) + '">';
        html += '<div class="bpw-shell-list-item-title">' + _esc(c.name || 'Untitled') + '</div>';
        if (c.description) html += '<div class="bpw-shell-list-item-sub">' + _esc(c.description) + '</div>';
        html += '</li>';
      }
      html += '</ul>';
    }
    html += '</aside>';
    return html;
  }

  function _renderCard(c, idx) {
    var html = '<article class="bpw-comp-card" data-idx="' + idx + '">';
    html += '<header class="bpw-comp-card-head">';
    html += '<h3 class="bpw-comp-card-name">' + _esc(c.name || 'Untitled') + '</h3>';
    if (c.url) html += '<a class="bpw-comp-card-link" href="' + _esc(c.url) + '" target="_blank" rel="noopener">' + _icon('arrow-up-right-from-square') + '</a>';
    html += '</header>';
    if (c.description) html += '<p class="bpw-comp-card-desc">' + _esc(c.description) + '</p>';
    var rows = [
      ['Strengths',  Array.isArray(c.strengths)  ? c.strengths.join('; ')  : (c.strengths  || '')],
      ['Weaknesses', Array.isArray(c.weaknesses) ? c.weaknesses.join('; ') : (c.weaknesses || '')],
      ['vs. you',    c.comparison || '']
    ];
    for (var r = 0; r < rows.length; r++) {
      if (!rows[r][1]) continue;
      html += '<div class="bpw-comp-card-row">';
      html += '<span class="bpw-comp-card-k">' + _esc(rows[r][0]) + '</span>';
      html += '<span class="bpw-comp-card-v">' + _esc(rows[r][1]) + '</span>';
      html += '</div>';
    }
    html += '</article>';
    return html;
  }

  function renderDetail(W) {
    var comps = _competitors(W);
    var html = '<section class="bpw-shell-detail" aria-label="Competitors">';
    html += '<header class="bpw-shell-detail-head">';
    html += '<h1>Competitors</h1>';
    html += '<button class="bpw-btn bpw-btn-ghost" data-action="ai-find-more-competitors" type="button">' + _icon('sparkles') + ' Find more competitors</button>';
    html += '</header>';
    if (!comps.length) {
      html += '<div class="bpw-shell-detail-empty">' + _icon('crosshairs')
           + '<h3>No competitors logged</h3>'
           + '<p>Run the Competitors stage from setup, or click "Find more" to research now.</p>'
           + '</div>';
    } else {
      html += '<div class="bpw-comp-grid">';
      for (var i = 0; i < comps.length; i++) {
        html += _renderCard(comps[i] || {}, i);
      }
      html += '</div>';
    }
    html += '</section>';
    return html;
  }

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.competitors = {
    renderList: renderList,
    renderDetail: renderDetail,
    listMode: 'variable-items'
  };
})();
