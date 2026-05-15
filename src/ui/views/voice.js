/**
 * @category    ui
 * @purpose     Voice + Messaging section view. fixed-cards mode.
 *              Sub-fields: tone, personality, dos, donts, preferred,
 *              avoided, sample, primary message, supporting messages.
 *              Editable detail pane (Phase 5).
 * @exports     window._bpwUIViews.voice
 */
(function() {
  'use strict';

  function _esc(s) { return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s); }
  function _E() { return window._bpwEditors; }

  var FIELDS = [
    { id: 'primary_tone',          label: 'Primary tone',          path: 'voice.primary_tone',                type: 'text' },
    { id: 'personality_traits',    label: 'Personality',           path: 'voice.personality_traits',          type: 'chips' },
    { id: 'dos',                   label: 'DOs',                   path: 'voice.dos',                         type: 'chips' },
    { id: 'donts',                 label: "DON'Ts",                path: 'voice.donts',                       type: 'chips' },
    { id: 'preferred_terms',       label: 'Preferred terms',       path: 'voice.vocabulary.preferred_terms',  type: 'chips' },
    { id: 'avoided_terms',         label: 'Avoided terms',         path: 'voice.vocabulary.avoided_terms',    type: 'chips' },
    { id: 'sample_texts',          label: 'Voice sample',          path: 'voice.sample_texts',                type: 'prose' },
    { id: 'primary_message',       label: 'Primary message',       path: 'messaging.primary_message',         type: 'prose' },
    { id: 'supporting_messages',   label: 'Supporting messages',   path: 'messaging.supporting_messages',     type: 'chips' },
    { id: 'headlines',             label: 'Headlines',             path: 'messaging.headlines',               type: 'list',
      listFields: [
        { key: 'context', label: 'Context', type: 'text', placeholder: 'e.g. Homepage hero' },
        { key: 'headline', label: 'Headline', type: 'textarea' }
      ],
      itemTemplate: { context: '', headline: '' }
    },
    { id: 'cta_phrases',           label: 'CTA phrases',           path: 'messaging.cta_phrases',             type: 'chips' }
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

  function _snippet(v, type) {
    if (v == null || v === '') return '';
    if (Array.isArray(v)) {
      return v.map(function(x) { return x && (x.headline || x.context || x.value || x.name) || x; }).filter(Boolean).slice(0, 5).join(' · ');
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
      var snippet = _snippet(v, f.type);
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
    var E = _E();
    var editor;
    if (field.type === 'list') {
      editor = E.renderList({ path: field.path, value: value || [], fields: field.listFields, itemTemplate: field.itemTemplate, addLabel: 'item' });
    } else {
      editor = E.renderField({ type: field.type, path: field.path, value: value, tall: field.tall, placeholder: field.placeholder });
    }
    return '<div class="bpw-shell-detail-card">'
      +    '<h3>' + _esc(field.label) + '</h3>'
      +    editor
      +    '</div>';
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
