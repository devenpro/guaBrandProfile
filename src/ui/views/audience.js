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

    if (selectedId === 'primary') {
      var v = a.primary_description;
      return '<div class="bpw-shell-detail-card">'
        + '<h3>Primary audience</h3>'
        + '<div class="bpw-shell-detail-row">'
        + '<div class="bpw-shell-detail-label">Description</div>'
        + (v ? '<div class="bpw-shell-detail-value">' + _esc(v) + '</div>' : '<div class="bpw-shell-detail-value bpw-shell-detail-value-empty">Not generated yet.</div>')
        + '</div></div>';
    }

    var parts = selectedId.split(':');
    var type = parts[0], idx = parseInt(parts[1] || '0', 10);
    if (type === 'segment') {
      var s = (a.segments || [])[idx];
      if (!s) return '<div class="bpw-shell-detail-empty">Segment not found.</div>';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(s.name || 'Segment') + '</h3>'
        + _detailRow('Description', s.description)
        + _detailRow('Pain points', s.pain_points, true)
        + _detailRow('Goals', s.goals, true)
        + _detailRow('Channels', s.channels, true)
        + '</div>';
    }
    if (type === 'persona') {
      var p = (a.personas || [])[idx];
      if (!p) return '<div class="bpw-shell-detail-empty">Persona not found.</div>';
      return '<div class="bpw-shell-detail-card">'
        + '<h3>' + _esc(p.name || 'Persona') + (p.role ? ' · ' + _esc(p.role) : '') + '</h3>'
        + _detailRow('Story', p.story)
        + _detailRow('Pain points', p.pain_points, true)
        + _detailRow('Goals', p.goals, true)
        + _detailRow('Decision criteria', p.decision_criteria, true)
        + _detailRow('Journey', p.journey)
        + '</div>';
    }
    return '';
  }

  function _detailRow(label, v, isList) {
    if (v == null || v === '' || (isList && Array.isArray(v) && !v.length)) {
      return '<div class="bpw-shell-detail-row"><div class="bpw-shell-detail-label">' + _esc(label) + '</div><div class="bpw-shell-detail-value bpw-shell-detail-value-empty">—</div></div>';
    }
    if (isList && Array.isArray(v)) {
      var lis = v.map(function(x) { return '<li>' + _esc(typeof x === 'object' ? JSON.stringify(x) : x) + '</li>'; }).join('');
      return '<div class="bpw-shell-detail-row"><div class="bpw-shell-detail-label">' + _esc(label) + '</div><ul class="bpw-shell-detail-value">' + lis + '</ul></div>';
    }
    return '<div class="bpw-shell-detail-row"><div class="bpw-shell-detail-label">' + _esc(label) + '</div><div class="bpw-shell-detail-value">' + _esc(typeof v === 'object' ? JSON.stringify(v, null, 2) : v) + '</div></div>';
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
      W.acceptedSections = W.acceptedSections || {};
      W.acceptedSections.audience = W.acceptedSections.audience || {};
      W.acceptedSections.audience.personas = (W.acceptedSections.audience.personas || []).concat(res.personas || []);
      if (window._bpwExportSync) window._bpwExportSync.syncAll();
      if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
      if (window._bpwAutoSave) window._bpwAutoSave();
      if (window._bpwAppShell) window._bpwAppShell.render();
      if (window._bpwToast) window._bpwToast('Added ' + (res.personas || []).length + ' personas', 'success');
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
