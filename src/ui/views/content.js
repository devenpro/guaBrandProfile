/**
 * @category    ui
 * @purpose     Content strategy view — v3 page-style layout.
 *
 *              Pillars (with topics), channels, SEO keywords, and
 *              hashtags all on one scrollable page with inline editors.
 *
 * @exports     window._bpwUIViews.content
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
  function _content(W) { return (W.acceptedSections && W.acceptedSections.content_strategy) || {}; }

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

  function _renderPillar(p, idx) {
    var base = 'content_strategy.pillars[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Pillar', path: base + 'pillar', value: p.pillar })
      + _E().renderTextarea({ label: 'Description', path: base + 'description', value: p.description })
      + _E().renderChips({ label: 'Topics', path: base + 'topics', value: p.topics, addLabel: 'topic' });
    return _fieldCard({
      label: p.pillar || 'Pillar ' + (idx + 1),
      path: 'content_strategy.pillars[' + idx + ']',
      body: body,
      removeAction: 'content-remove-pillar',
      removeIdx: idx
    });
  }

  function _renderChannel(ch, idx) {
    var base = 'content_strategy.channels[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Channel', path: base + 'channel', value: ch.channel })
      + _E().renderTextarea({ label: 'Purpose', path: base + 'purpose', value: ch.purpose })
      + _E().renderText({ label: 'Frequency', path: base + 'frequency', value: ch.frequency, placeholder: 'e.g. 3x/week' })
      + _E().renderText({ label: 'Format', path: base + 'format', value: ch.format, placeholder: 'e.g. short-form video' });
    return _fieldCard({
      label: ch.channel || 'Channel ' + (idx + 1),
      path: 'content_strategy.channels[' + idx + ']',
      body: body,
      removeAction: 'content-remove-channel',
      removeIdx: idx
    });
  }

  function renderList() { return ''; }

  function renderDetail(W) {
    var c = _content(W);
    var pillars = c.pillars || [];
    var channels = c.channels || [];

    var html = '<section class="bpw-shell-detail bpw-shell-detail--page" aria-label="Content strategy">';
    html += '<header class="bpw-shell-detail-head">';
    html += '<h1>Content strategy</h1>';
    html += '<p class="bpw-shell-detail-sub">Pillars, channels, SEO keywords, and hashtags.</p>';
    html += '</header>';

    html += '<div class="bpw-page-fields">';

    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Pillars</h2>';
    html += '<button class="bpw-page-collection-add" data-action="content-add-pillar" type="button">' + _icon('plus') + ' Add pillar</button>';
    html += '</div>';
    if (!pillars.length) html += '<div class="bpw-page-collection-empty">No pillars yet.</div>';
    else for (var i = 0; i < pillars.length; i++) html += _renderPillar(pillars[i], i);

    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Channels</h2>';
    html += '<button class="bpw-page-collection-add" data-action="content-add-channel" type="button">' + _icon('plus') + ' Add channel</button>';
    html += '</div>';
    if (!channels.length) html += '<div class="bpw-page-collection-empty">No channels yet.</div>';
    else for (var j = 0; j < channels.length; j++) html += _renderChannel(channels[j], j);

    html += _fieldCard({
      label: 'SEO keywords',
      path: 'content_strategy.seo_keywords',
      body: _E().renderChips({ path: 'content_strategy.seo_keywords', value: c.seo_keywords || [], addLabel: 'keyword' })
    });
    html += _fieldCard({
      label: 'Hashtags',
      path: 'content_strategy.hashtags',
      body: _E().renderChips({ path: 'content_strategy.hashtags', value: c.hashtags || [], addLabel: 'tag' })
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

  $(document).off('click.bpw-cnt-add-p').on('click.bpw-cnt-add-p', '[data-action="content-add-pillar"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.content_strategy = W.acceptedSections.content_strategy || {};
    W.acceptedSections.content_strategy.pillars = W.acceptedSections.content_strategy.pillars || [];
    W.acceptedSections.content_strategy.pillars.push({ pillar: '', description: '', topics: [] });
    _refresh();
  });
  $(document).off('click.bpw-cnt-rm-p').on('click.bpw-cnt-rm-p', '[data-action="content-remove-pillar"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (isNaN(idx)) return;
    var W = window._bpwState;
    var arr = W.acceptedSections && W.acceptedSections.content_strategy && W.acceptedSections.content_strategy.pillars;
    if (!arr) return;
    arr.splice(idx, 1);
    _refresh();
  });
  $(document).off('click.bpw-cnt-add-c').on('click.bpw-cnt-add-c', '[data-action="content-add-channel"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.content_strategy = W.acceptedSections.content_strategy || {};
    W.acceptedSections.content_strategy.channels = W.acceptedSections.content_strategy.channels || [];
    W.acceptedSections.content_strategy.channels.push({ channel: '', purpose: '', frequency: '', format: '' });
    _refresh();
  });
  $(document).off('click.bpw-cnt-rm-c').on('click.bpw-cnt-rm-c', '[data-action="content-remove-channel"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (isNaN(idx)) return;
    var W = window._bpwState;
    var arr = W.acceptedSections && W.acceptedSections.content_strategy && W.acceptedSections.content_strategy.channels;
    if (!arr) return;
    arr.splice(idx, 1);
    _refresh();
  });

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.content = {
    id: 'content',
    title: 'Content strategy',
    minLevel: 'new',
    listMode: 'none',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
