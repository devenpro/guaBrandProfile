/**
 * @category    ui
 * @purpose     Audience section view. variable-items mode with two
 *              sub-collections (segments + personas) plus the primary
 *              description as a single card. Inline action: Generate
 *              more personas.
 *
 * @exports     window._bpwUIViews.audience
 *
 * Item ids:
 *   'primary'           → primary_description card
 *   'segment:<index>'   → audience.segments[index]
 *   'persona:<index>'   → audience.personas[index]
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
  function _aud(W) { return (W.acceptedSections && W.acceptedSections.audience) || {}; }

  function renderList(W) {
    var a = _aud(W);
    var active = (W.ui && W.ui.itemId) || null;
    var html = '';

    // Primary
    var pCls = active === 'primary' ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
    html += '<article class="' + pCls + '" data-item-id="primary" role="button" tabindex="0">';
    html += '<div class="bpw-shell-card-title">' + _icon('users') + ' Primary audience</div>';
    html += '<div class="bpw-shell-card-snippet">' + (a.primary_description ? _esc(a.primary_description) : '<em class="bpw-shell-detail-value-empty">Not set yet</em>') + '</div>';
    html += '</article>';

    // Segments
    var segments = a.segments || [];
    if (segments.length) html += '<div class="bpw-shell-card-divider">Segments</div>';
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var id = 'segment:' + i;
      var cls = active === id ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + cls + '" data-item-id="' + _esc(id) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(s.name || 'Segment ' + (i + 1)) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(s.description || '') + '</div>';
      html += '</article>';
    }

    // Personas
    var personas = a.personas || [];
    if (personas.length) html += '<div class="bpw-shell-card-divider">Personas</div>';
    for (var j = 0; j < personas.length; j++) {
      var p = personas[j];
      var pid = 'persona:' + j;
      var pcls = active === pid ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + pcls + '" data-item-id="' + _esc(pid) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(p.name || 'Persona ' + (j + 1)) + (p.role ? ' · ' + _esc(p.role) : '') + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(p.story || '') + '</div>';
      html += '</article>';
    }

    return html;
  }

  function renderDetail(W, selectedId) {
    if (!selectedId) return '';
    var a = _aud(W);
    var E = window._bpwEditors;

    if (selectedId === 'primary') {
      return '<div class="bpw-shell-detail-card">'
        + '<h3>Primary audience</h3>'
        + E.renderField({ type: 'prose', label: 'Description', path: 'audience.primary_description', value: a.primary_description })
        + '</div>';
    }

    var parts = selectedId.split(':');
    var type = parts[0], idx = parseInt(parts[1] || '0', 10);
    if (type === 'segment') {
      var s = (a.segments || [])[idx];
      if (!s) return '<div class="bpw-shell-detail-empty">Segment not found.</div>';
      var base = 'audience.segments[' + idx + '].';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(s.name || 'Segment ' + (idx + 1)) + '</h3>'
        + E.renderText({ label: 'Name', path: base + 'name', value: s.name })
        + E.renderTextarea({ label: 'Description', path: base + 'description', value: s.description })
        + E.renderChips({ label: 'Pain points', path: base + 'pain_points', value: s.pain_points, addLabel: 'pain' })
        + E.renderChips({ label: 'Goals', path: base + 'goals', value: s.goals, addLabel: 'goal' })
        + E.renderChips({ label: 'Channels', path: base + 'channels', value: s.channels, addLabel: 'channel' })
        + '</div>';
    }
    if (type === 'persona') {
      var p = (a.personas || [])[idx];
      if (!p) return '<div class="bpw-shell-detail-empty">Persona not found.</div>';
      var pbase = 'audience.personas[' + idx + '].';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(p.name || 'Persona ' + (idx + 1)) + '</h3>'
        + E.renderText({ label: 'Name', path: pbase + 'name', value: p.name })
        + E.renderText({ label: 'Role', path: pbase + 'role', value: p.role })
        + E.renderText({ label: 'Age', path: pbase + 'age', value: p.age })
        + E.renderField({ type: 'prose', label: 'Story', path: pbase + 'story', value: p.story })
        + E.renderField({ type: 'prose', label: 'Journey', path: pbase + 'journey', value: p.journey })
        + E.renderChips({ label: 'Pain points', path: pbase + 'pain_points', value: p.pain_points })
        + E.renderChips({ label: 'Goals', path: pbase + 'goals', value: p.goals })
        + E.renderChips({ label: 'Decision criteria', path: pbase + 'decision_criteria', value: p.decision_criteria })
        + '</div>';
    }
    return '';
  }

  // ── Inline action: Generate more personas ──────────────────────────
  $(document).off('click.bpw-personas-more').on('click.bpw-personas-more', '[data-action="generate-more-personas"]', function(e) {
    e.preventDefault();
    var W = window._bpwState;
    var action = window._bpwAIActions && window._bpwAIActions.personas && window._bpwAIActions.personas.generateMore;
    if (!action) { if (window._bpwToast) window._bpwToast('Personas action not registered', 'error'); return; }
    var $btn = $(this).prop('disabled', true).html(_icon('spinner fa-spin') + ' Generating…');
    action('', function(res) {
      $btn.prop('disabled', false).html(_icon('sparkles') + ' Generate more personas');
      if (!res || !res.success) { if (window._bpwToast) window._bpwToast(res && res.error || 'Failed', 'error'); return; }
      var personas = (res.data && res.data.personas) || [];
      W.acceptedSections = W.acceptedSections || {};
      W.acceptedSections.audience = W.acceptedSections.audience || {};
      W.acceptedSections.audience.personas = (W.acceptedSections.audience.personas || []).concat(personas);
      if (window._bpwExportSync) window._bpwExportSync.syncAll();
      if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
      if (window._bpwAutoSave) window._bpwAutoSave();
      if (window._bpwAppShell) window._bpwAppShell.render();
      if (window._bpwToast) window._bpwToast('Added ' + personas.length + ' personas', 'success');
    });
  });

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.audience = {
    id: 'audience',
    title: 'Audience',
    minLevel: 'new',
    listMode: 'variable-items',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: [
      { id: 'generate-more-personas', label: 'Generate more personas', icon: 'sparkles' }
    ]
  };
})();
