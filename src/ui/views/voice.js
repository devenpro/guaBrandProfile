/**
 * @category    ui
 * @purpose     Voice + Messaging section view. fixed-cards mode.
 *              Sub-fields: tone, personality, dos, donts, preferred,
 *              avoided, sample, primary message, supporting messages.
 * @exports     window._bpwUIViews.voice
 */
(function() {
  'use strict';

  function _esc(s) { return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s); }

  var FIELDS = [
    { id: 'primary_tone',          label: 'Primary tone',          path: 'voice.primary_tone' },
    { id: 'personality_traits',    label: 'Personality',           path: 'voice.personality_traits',     isList: true },
    { id: 'dos',                   label: 'DOs',                   path: 'voice.dos',                    isList: true },
    { id: 'donts',                 label: "DON'Ts",                path: 'voice.donts',                  isList: true },
    { id: 'preferred_terms',       label: 'Preferred terms',       path: 'voice.vocabulary.preferred_terms', isList: true },
    { id: 'avoided_terms',         label: 'Avoided terms',         path: 'voice.vocabulary.avoided_terms',   isList: true },
    { id: 'sample_texts',          label: 'Voice sample',          path: 'voice.sample_texts' },
    { id: 'primary_message',       label: 'Primary message',       path: 'messaging.primary_message' },
    { id: 'supporting_messages',   label: 'Supporting messages',   path: 'messaging.supporting_messages', isList: true },
    { id: 'headlines',             label: 'Headlines',             path: 'messaging.headlines',           isList: true }
  ];

  function _readPath(W, path) {
    var parts = path.split('.');
    var cur = W.acceptedSections || {};
    for (var i = 0; i < parts.length; i++) {
      if (!cur || typeof cur !== 'object') return null;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function _snippet(v, isList) {
    if (v == null || v === '') return '';
    if (isList && Array.isArray(v)) {
      return v.map(function(x) { return x.headline || x.context || x.value || x.name || x; }).slice(0, 5).join(' · ');
    }
    if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return ''; } }
    return String(v);
  }

  function renderList(W) {
    var activeItem = (W.ui && W.ui.itemId) || null;
    var html = '';
    for (var i = 0; i < FIELDS.length; i++) {
      var f = FIELDS[i];
      var v = _readPath(W, f.path);
      var snippet = _snippet(v, f.isList);
      var cls = activeItem === f.id ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + cls + '" data-item-id="' + _esc(f.id) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(f.label) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + (snippet ? _esc(snippet) : '<em class="bpw-shell-detail-value-empty">Not set yet</em>') + '</div>';
      html += '</article>';
    }
    return html;
  }

  function renderDetail(W, selectedId) {
    if (!selectedId) return '';
    var field = null;
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].id === selectedId) { field = FIELDS[i]; break; }
    if (!field) return '';
    var value = _readPath(W, field.path);
    var html = '<div class="bpw-shell-detail-card">';
    html += '<h3>' + _esc(field.label) + '</h3>';
    html += '<div class="bpw-shell-detail-row">';
    html += '<div class="bpw-shell-detail-label">Current value</div>';
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) {
      html += '<div class="bpw-shell-detail-value bpw-shell-detail-value-empty">Not generated yet.</div>';
    } else if (field.isList && Array.isArray(value)) {
      html += '<ul class="bpw-shell-detail-value">';
      for (var j = 0; j < value.length; j++) {
        var v = value[j];
        if (v && (v.headline || v.context)) {
          html += '<li><strong>' + _esc(v.context || 'Headline') + ':</strong> ' + _esc(v.headline || '') + '</li>';
        } else {
          html += '<li>' + _esc(typeof v === 'object' ? JSON.stringify(v) : v) + '</li>';
        }
      }
      html += '</ul>';
    } else {
      html += '<div class="bpw-shell-detail-value">' + _esc(typeof value === 'object' ? JSON.stringify(value, null, 2) : value) + '</div>';
    }
    html += '</div></div>';
    return html;
  }

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.voice = {
    id: 'voice',
    title: 'Voice & messaging',
    minLevel: 'new',
    listMode: 'fixed-cards',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
