/**
 * @category    ui
 * @purpose     Voice + Messaging section view — v2 page-style layout.
 *
 *              All voice + messaging fields (primary tone, personality,
 *              dos/donts, vocabulary, sample, primary message,
 *              supporting messages, headlines, CTAs) rendered inline
 *              on a single scrollable page. Matches the canonical
 *              Identity page pattern.
 *
 * @exports     window._bpwUIViews.voice
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
  function _E() { return window._bpwEditors; }

  var FIELDS = [
    { id: 'primary_tone',        label: 'Primary tone',        path: 'voice.primary_tone',                type: 'text' },
    { id: 'personality_traits',  label: 'Personality',         path: 'voice.personality_traits',          type: 'chips' },
    { id: 'dos',                 label: 'DOs',                 path: 'voice.dos',                         type: 'chips' },
    { id: 'donts',               label: "DON'Ts",              path: 'voice.donts',                       type: 'chips' },
    { id: 'preferred_terms',     label: 'Preferred terms',     path: 'voice.vocabulary.preferred_terms',  type: 'chips' },
    { id: 'avoided_terms',       label: 'Avoided terms',       path: 'voice.vocabulary.avoided_terms',    type: 'chips' },
    { id: 'sample_texts',        label: 'Voice sample',        path: 'voice.sample_texts',                type: 'prose' },
    { id: 'primary_message',     label: 'Primary message',     path: 'messaging.primary_message',         type: 'prose' },
    { id: 'supporting_messages', label: 'Supporting messages', path: 'messaging.supporting_messages',     type: 'chips' },
    { id: 'headlines',           label: 'Headlines',           path: 'messaging.headlines',               type: 'list',
      listFields: [
        { key: 'context', label: 'Context', type: 'text', placeholder: 'e.g. Homepage hero' },
        { key: 'headline', label: 'Headline', type: 'textarea' }
      ],
      itemTemplate: { context: '', headline: '' }
    },
    { id: 'cta_phrases',         label: 'CTA phrases',         path: 'messaging.cta_phrases',             type: 'chips' }
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

  function _renderFieldCard(W, field) {
    var value = _readPath(W, field.path);
    var E = _E();
    var editor;
    if (field.type === 'list') {
      editor = E.renderList({ path: field.path, value: value || [], fields: field.listFields, itemTemplate: field.itemTemplate, addLabel: 'item' });
    } else {
      editor = E.renderField({ type: field.type, path: field.path, value: value, tall: field.tall, placeholder: field.placeholder });
    }
    return '<article class="bpw-page-field" data-field-id="' + _esc(field.id) + '">'
      +    '<header class="bpw-page-field-head">'
      +      '<h3 class="bpw-page-field-label">' + _esc(field.label) + '</h3>'
      +      '<button class="bpw-page-field-refine" data-action="refine" data-refine-path="' + _esc(field.path) + '" type="button" title="Improve with AI">'
      +        _icon('sparkles')
      +      '</button>'
      +    '</header>'
      +    '<div class="bpw-page-field-body">' + editor + '</div>'
      +  '</article>';
  }

  function renderList() { return ''; }

  function renderDetail(W) {
    var html = '<section class="bpw-shell-detail bpw-shell-detail--page" aria-label="Voice and messaging">';
    html += '<header class="bpw-shell-detail-head">';
    html += '<h1>Voice &amp; messaging</h1>';
    html += '<p class="bpw-shell-detail-sub">Tone, personality, vocabulary, sample, primary message, headlines &amp; CTAs. All editable inline.</p>';
    html += '</header>';
    html += '<div class="bpw-page-fields">';
    for (var i = 0; i < FIELDS.length; i++) {
      html += _renderFieldCard(W, FIELDS[i]);
    }
    html += '</div>';
    html += '</section>';
    return html;
  }

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.voice = {
    id: 'voice',
    title: 'Voice & messaging',
    minLevel: 'new',
    listMode: 'none',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
