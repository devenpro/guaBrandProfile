/**
 * @category    ui
 * @purpose     Content strategy view. variable-items mode.
 *              Lists pillars + channels, plus SEO keywords and hashtags
 *              as aggregated cards.
 * @exports     window._bpwUIViews.content
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
  function _content(W) { return (W.acceptedSections && W.acceptedSections.content_strategy) || {}; }

  function renderList(W) {
    var c = _content(W);
    var active = (W.ui && W.ui.itemId) || null;
    var html = '';

    var pillars = c.pillars || [];
    if (pillars.length) html += '<div class="bpw-shell-card-divider">Pillars</div>';
    for (var i = 0; i < pillars.length; i++) {
      var p = pillars[i];
      var id = 'pillar:' + i;
      var cls = active === id ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + cls + '" data-item-id="' + _esc(id) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(p.pillar || 'Pillar ' + (i + 1)) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(p.description || '') + '</div>';
      html += '</article>';
    }

    var channels = c.channels || [];
    if (channels.length) html += '<div class="bpw-shell-card-divider">Channels</div>';
    for (var j = 0; j < channels.length; j++) {
      var ch = channels[j];
      var cid = 'channel:' + j;
      var ccls = active === cid ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + ccls + '" data-item-id="' + _esc(cid) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(ch.channel || 'Channel ' + (j + 1)) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(ch.purpose || '') + (ch.frequency ? ' · ' + _esc(ch.frequency) : '') + '</div>';
      html += '</article>';
    }

    var seo = c.seo_keywords || [];
    if (seo.length) {
      var sCls = active === 'seo' ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + sCls + '" data-item-id="seo" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _icon('magnifying-glass') + ' SEO keywords (' + seo.length + ')</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(seo.slice(0, 6).join(', ')) + '</div>';
      html += '</article>';
    }
    var tags = c.hashtags || [];
    if (tags.length) {
      var hCls = active === 'hashtags' ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + hCls + '" data-item-id="hashtags" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _icon('hashtag') + ' Hashtags (' + tags.length + ')</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(tags.slice(0, 6).join(' ')) + '</div>';
      html += '</article>';
    }

    return html || '<div class="bpw-shell-list-empty">' + _icon('pen-nib') + '<p>No content strategy yet.</p></div>';
  }

  function renderDetail(W, selectedId) {
    if (!selectedId) return '';
    var c = _content(W);
    var E = window._bpwEditors;

    if (selectedId === 'seo') {
      return '<div class="bpw-shell-detail-card">'
        + '<h3>SEO keywords</h3>'
        + E.renderChips({ label: 'Keywords', path: 'content_strategy.seo_keywords', value: c.seo_keywords || [], addLabel: 'keyword' })
        + '</div>';
    }
    if (selectedId === 'hashtags') {
      return '<div class="bpw-shell-detail-card">'
        + '<h3>Hashtags</h3>'
        + E.renderChips({ label: 'Tags', path: 'content_strategy.hashtags', value: c.hashtags || [], addLabel: 'tag' })
        + '</div>';
    }

    var parts = selectedId.split(':');
    var type = parts[0], idx = parseInt(parts[1] || '0', 10);
    if (type === 'pillar') {
      var p = (c.pillars || [])[idx];
      if (!p) return '<div class="bpw-shell-detail-empty">Pillar not found.</div>';
      var base = 'content_strategy.pillars[' + idx + '].';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(p.pillar || 'Pillar ' + (idx + 1)) + '</h3>'
        + E.renderText({ label: 'Pillar', path: base + 'pillar', value: p.pillar })
        + E.renderTextarea({ label: 'Description', path: base + 'description', value: p.description })
        + E.renderChips({ label: 'Topics', path: base + 'topics', value: p.topics, addLabel: 'topic' })
        + '</div>';
    }
    if (type === 'channel') {
      var ch = (c.channels || [])[idx];
      if (!ch) return '<div class="bpw-shell-detail-empty">Channel not found.</div>';
      var cbase = 'content_strategy.channels[' + idx + '].';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(ch.channel || 'Channel ' + (idx + 1)) + '</h3>'
        + E.renderText({ label: 'Channel', path: cbase + 'channel', value: ch.channel })
        + E.renderTextarea({ label: 'Purpose', path: cbase + 'purpose', value: ch.purpose })
        + E.renderText({ label: 'Frequency', path: cbase + 'frequency', value: ch.frequency, placeholder: 'e.g. 3x/week' })
        + E.renderText({ label: 'Format', path: cbase + 'format', value: ch.format, placeholder: 'e.g. short-form video' })
        + '</div>';
    }
    return '';
  }

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.content = {
    id: 'content',
    title: 'Content strategy',
    minLevel: 'new',
    listMode: 'variable-items',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
