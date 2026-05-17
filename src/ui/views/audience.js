/**
 * @category    ui
 * @purpose     Audience section view — v3 page-style layout.
 *
 *              Single-pane page with primary description as a card,
 *              then each segment and each persona as its own field
 *              card with inline editors. Add/remove buttons at the
 *              bottom of each collection.
 *
 * @exports     window._bpwUIViews.audience
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
  function _aud(W) { return (W.acceptedSections && W.acceptedSections.audience) || {}; }

  function _fieldCard(opts) {
    // opts = { label, path, body, removeAction?, removeIdx? }
    var remove = '';
    if (opts.removeAction) {
      remove = '<button class="bpw-page-field-remove" data-action="' + _esc(opts.removeAction) + '" data-idx="' + opts.removeIdx + '" type="button" title="Remove">' + _icon('xmark') + '</button>';
    }
    var sparkle = '';
    if (opts.path) {
      sparkle = '<button class="bpw-page-field-refine" data-action="refine" data-refine-path="' + _esc(opts.path) + '" type="button" title="Improve with AI">' + _icon('sparkles') + '</button>';
    }
    return '<article class="bpw-page-field">'
      + '<header class="bpw-page-field-head">'
      +   '<h3 class="bpw-page-field-label">' + _esc(opts.label) + '</h3>'
      +   '<div class="bpw-page-field-head-actions">' + sparkle + remove + '</div>'
      + '</header>'
      + '<div class="bpw-page-field-body">' + opts.body + '</div>'
      + '</article>';
  }

  function _renderPrimary(W) {
    var a = _aud(W);
    var body = _E().renderField({ type: 'prose', path: 'audience.primary_description', value: a.primary_description });
    return _fieldCard({ label: 'Primary audience', path: 'audience.primary_description', body: body });
  }

  function _renderSegment(W, segment, idx) {
    var base = 'audience.segments[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Name', path: base + 'name', value: segment.name })
      + _E().renderTextarea({ label: 'Description', path: base + 'description', value: segment.description })
      + _E().renderChips({ label: 'Pain points', path: base + 'pain_points', value: segment.pain_points, addLabel: 'pain' })
      + _E().renderChips({ label: 'Goals', path: base + 'goals', value: segment.goals, addLabel: 'goal' })
      + _E().renderChips({ label: 'Channels', path: base + 'channels', value: segment.channels, addLabel: 'channel' });
    return _fieldCard({
      label: segment.name || 'Segment ' + (idx + 1),
      path: 'audience.segments[' + idx + ']',
      body: body,
      removeAction: 'audience-remove-segment',
      removeIdx: idx
    });
  }

  function _renderPersona(W, persona, idx) {
    var base = 'audience.personas[' + idx + '].';
    var body = ''
      + _E().renderText({ label: 'Name', path: base + 'name', value: persona.name })
      + _E().renderText({ label: 'Role', path: base + 'role', value: persona.role })
      + _E().renderText({ label: 'Age', path: base + 'age', value: persona.age })
      + _E().renderField({ type: 'prose', label: 'Story', path: base + 'story', value: persona.story })
      + _E().renderField({ type: 'prose', label: 'Journey', path: base + 'journey', value: persona.journey })
      + _E().renderChips({ label: 'Pain points', path: base + 'pain_points', value: persona.pain_points })
      + _E().renderChips({ label: 'Goals', path: base + 'goals', value: persona.goals })
      + _E().renderChips({ label: 'Decision criteria', path: base + 'decision_criteria', value: persona.decision_criteria });
    return _fieldCard({
      label: persona.name ? (persona.name + (persona.role ? ' · ' + persona.role : '')) : 'Persona ' + (idx + 1),
      path: 'audience.personas[' + idx + ']',
      body: body,
      removeAction: 'audience-remove-persona',
      removeIdx: idx
    });
  }

  function renderList() { return ''; }

  function renderDetail(W) {
    var a = _aud(W);
    var segments = a.segments || [];
    var personas = a.personas || [];

    var html = '<section class="bpw-shell-detail bpw-shell-detail--page" aria-label="Audience">';
    html += '<header class="bpw-shell-detail-head">';
    html += '<h1>Audience</h1>';
    html += '<p class="bpw-shell-detail-sub">Primary description, segments, and personas. Hover any card to refine, regenerate, or copy.</p>';
    html += '</header>';

    html += '<div class="bpw-page-fields">';
    html += _renderPrimary(W);

    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Segments</h2>';
    html += '<button class="bpw-page-collection-add" data-action="audience-add-segment" type="button">' + _icon('plus') + ' Add segment</button>';
    html += '</div>';
    if (!segments.length) {
      html += '<div class="bpw-page-collection-empty">No segments yet.</div>';
    } else {
      for (var i = 0; i < segments.length; i++) html += _renderSegment(W, segments[i], i);
    }

    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">Personas</h2>';
    html += '<div class="bpw-page-collection-actions">';
    html += '<button class="bpw-page-collection-add" data-action="audience-add-persona" type="button">' + _icon('plus') + ' Add persona</button>';
    html += '<button class="bpw-page-collection-add bpw-page-collection-add--ai" data-action="generate-more-personas" type="button">' + _icon('sparkles') + ' Generate more</button>';
    html += '</div>';
    html += '</div>';
    if (!personas.length) {
      html += '<div class="bpw-page-collection-empty">No personas yet.</div>';
    } else {
      for (var j = 0; j < personas.length; j++) html += _renderPersona(W, personas[j], j);
    }
    html += '</div>';
    html += '</section>';
    return html;
  }

  // ── Inline actions ────────────────────────────────────────────────
  function _store() { return window._bpwPathStore; }
  function _refresh() {
    if (window._bpwExportSync) window._bpwExportSync.syncAll();
    if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
    if (window._bpwAutoSave) window._bpwAutoSave();
    if (window._bpwAppShell) window._bpwAppShell.render();
    // Also rerender the setup wizard when open — its stage pane reuses
    // this same renderDetail.
    if (window._bpwSetup && window._bpwSetup.render) window._bpwSetup.render();
  }

  $(document).off('click.bpw-aud-add-seg').on('click.bpw-aud-add-seg', '[data-action="audience-add-segment"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.audience = W.acceptedSections.audience || {};
    W.acceptedSections.audience.segments = W.acceptedSections.audience.segments || [];
    W.acceptedSections.audience.segments.push({ name: '', description: '', pain_points: [], goals: [], channels: [] });
    _refresh();
  });

  $(document).off('click.bpw-aud-rm-seg').on('click.bpw-aud-rm-seg', '[data-action="audience-remove-segment"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (isNaN(idx)) return;
    var W = window._bpwState;
    var arr = W.acceptedSections && W.acceptedSections.audience && W.acceptedSections.audience.segments;
    if (!arr) return;
    arr.splice(idx, 1);
    _refresh();
  });

  $(document).off('click.bpw-aud-add-per').on('click.bpw-aud-add-per', '[data-action="audience-add-persona"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.audience = W.acceptedSections.audience || {};
    W.acceptedSections.audience.personas = W.acceptedSections.audience.personas || [];
    W.acceptedSections.audience.personas.push({ name: '', role: '', age: '', story: '', journey: '', pain_points: [], goals: [], decision_criteria: [] });
    _refresh();
  });

  $(document).off('click.bpw-aud-rm-per').on('click.bpw-aud-rm-per', '[data-action="audience-remove-persona"]', function(e) {
    e.preventDefault();
    var idx = parseInt($(this).attr('data-idx'), 10);
    if (isNaN(idx)) return;
    var W = window._bpwState;
    var arr = W.acceptedSections && W.acceptedSections.audience && W.acceptedSections.audience.personas;
    if (!arr) return;
    arr.splice(idx, 1);
    _refresh();
  });

  // ── Inline action: Generate more personas (preserved from v2) ─────
  $(document).off('click.bpw-personas-more').on('click.bpw-personas-more', '[data-action="generate-more-personas"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    var action = window._bpwAIActions && window._bpwAIActions.personas && window._bpwAIActions.personas.generateMore;
    if (!action) { if (window._bpwToast) window._bpwToast('Personas action not registered', 'error'); return; }
    var $btn = $(this).prop('disabled', true).html(_icon('spinner fa-spin') + ' Generating…');
    action('', function(res) {
      $btn.prop('disabled', false).html(_icon('sparkles') + ' Generate more');
      if (!res || !res.success) { if (window._bpwToast) window._bpwToast(res && res.error || 'Failed', 'error'); return; }
      var personas = (res.data && res.data.personas) || [];
      W.acceptedSections = W.acceptedSections || {};
      W.acceptedSections.audience = W.acceptedSections.audience || {};
      W.acceptedSections.audience.personas = (W.acceptedSections.audience.personas || []).concat(personas);
      _refresh();
      if (window._bpwToast) window._bpwToast('Added ' + personas.length + ' personas', 'success');
    });
  });

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.audience = {
    id: 'audience',
    title: 'Audience',
    minLevel: 'new',
    listMode: 'none',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
