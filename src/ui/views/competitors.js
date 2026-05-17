/**
 * @category    ui
 * @purpose     Competitors view — v3 page-style focused editor.
 *
 *              Surfaces W.acceptedSections.market.competitors as its
 *              own page. Same data slot as market.js — edits here
 *              propagate to the Market view and the wizard pane.
 *
 * @exports     window._bpwUIViews.competitors
 * @depends-on  window._bpwState, window._bpwEditors, window._bpwIcon
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

  function _comps(W) {
    var market = ((W.acceptedSections || {}).market) || {};
    return Array.isArray(market.competitors) ? market.competitors : [];
  }

  function _fieldCard(label, path, body, removeIdx) {
    var remove = (removeIdx != null)
      ? '<button class="bpw-page-field-remove" data-action="market-remove-competitor" data-idx="' + removeIdx + '" type="button" title="Remove">' + _icon('xmark') + '</button>'
      : '';
    var sparkle = path
      ? '<button class="bpw-page-field-refine" data-action="refine" data-refine-path="' + _esc(path) + '" type="button" title="Improve with AI">' + _icon('sparkles') + '</button>'
      : '';
    return '<article class="bpw-page-field">'
      + '<header class="bpw-page-field-head">'
      +   '<h3 class="bpw-page-field-label">' + _esc(label) + '</h3>'
      +   '<div class="bpw-page-field-head-actions">' + sparkle + remove + '</div>'
      + '</header>'
      + '<div class="bpw-page-field-body">' + body + '</div>'
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
    return _fieldCard(c.name || 'Competitor ' + (idx + 1), 'market.competitors[' + idx + ']', body, idx);
  }

  function renderList() { return ''; }

  function renderDetail(W) {
    var comps = _comps(W);
    var html = '<section class="bpw-shell-detail bpw-shell-detail--page" aria-label="Competitors">';
    html += '<header class="bpw-shell-detail-head">';
    html += '<h1>Competitors</h1>';
    html += '<p class="bpw-shell-detail-sub">Same data as Market → Competitors, focused for deeper editing.</p>';
    html += '</header>';

    html += '<div class="bpw-page-fields">';
    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">' + comps.length + ' competitor' + (comps.length === 1 ? '' : 's') + '</h2>';
    html += '<div class="bpw-page-collection-actions">';
    html += '<button class="bpw-page-collection-add" data-action="market-add-competitor" type="button">' + _icon('plus') + ' Add competitor</button>';
    html += '<button class="bpw-page-collection-add bpw-page-collection-add--ai" data-action="find-more-competitors" type="button">' + _icon('sparkles') + ' Find more</button>';
    html += '</div></div>';
    if (!comps.length) {
      html += '<div class="bpw-page-collection-empty">No competitors yet. Click "Find more" to research with AI.</div>';
    } else {
      for (var i = 0; i < comps.length; i++) html += _renderCompetitor(comps[i], i);
    }
    html += '</div>';
    html += '</section>';
    return html;
  }

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.competitors = {
    id: 'competitors',
    title: 'Competitors',
    listMode: 'none',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
