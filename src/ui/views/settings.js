/**
 * @category    ui
 * @purpose     Settings view — v2 page-style layout. All settings on a
 *              single page: brand basics, growth-phase switcher, AI
 *              provider/model, brand details (the dump), re-run setup.
 *
 *              Growth-phase upgrade surfaces a confirmation modal before
 *              calling openDelta(newLevel), which re-runs the new stages
 *              through the same per-stage review screens the user used
 *              during initial setup (see Phase 4 review gates).
 *
 *              Downgrade keeps all existing data and just writes the new
 *              level — no AI runs.
 *
 * @exports     window._bpwUIViews.settings
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

  var PHASES = [
    { key: 'new',     emoji: '🌱', label: 'New',         desc: 'Just starting — concise, foundational output' },
    { key: 'growing', emoji: '🚀', label: 'Growing',     desc: 'Established but scaling — standard depth' },
    // Internal value 'deep' stays for back-compat; label is 'Established'.
    { key: 'deep',    emoji: '🏛', label: 'Established', desc: 'Mature — rich, multi-variant, deep competitive lens' }
  ];

  function _section(title, sub, body) {
    return '<section class="bpw-settings-section">'
      +    '<header class="bpw-settings-section-head">'
      +      '<h3>' + _esc(title) + '</h3>'
      +      (sub ? '<p>' + _esc(sub) + '</p>' : '')
      +    '</header>'
      +    '<div class="bpw-settings-section-body">' + body + '</div>'
      +  '</section>';
  }

  function _renderBasics(W) {
    var name = (W.acceptedSections && W.acceptedSections.identity && W.acceptedSections.identity.name) || '';
    var url = (W.seedContext && (W.seedContext.url || W.seedContext.website_url)) || '';
    var body = '';
    body += '<div class="bpw-settings-row"><label>Brand name</label>'
         +  '<input class="bpw-settings-input" data-settings-field="name" type="text" value="' + _esc(name) + '"></div>';
    body += '<div class="bpw-settings-row"><label>Website URL</label>'
         +  '<input class="bpw-settings-input" data-settings-field="url" type="url" value="' + _esc(url) + '"></div>';
    body += '<div class="bpw-settings-row"><label>Language</label>'
         +  _languageSelect(W) + '</div>';
    body += '<div class="bpw-settings-row"><label>Brand types</label>'
         +  _typesPills(W) + '</div>';
    return _section('Brand basics', 'Inline editable; changes ripple into every future AI run.', body);
  }

  function _languageSelect(W) {
    var LANG = (window._bpwConstants && window._bpwConstants.LANGUAGES) || [{ code: 'en', label: 'English' }];
    var cur = W.language || 'en';
    var opts = LANG.map(function(l) {
      return '<option value="' + _esc(l.code) + '"' + (l.code === cur ? ' selected' : '') + '>' + _esc(l.label) + '</option>';
    }).join('');
    return '<select class="bpw-settings-input" data-settings-field="language">' + opts + '</select>';
  }

  function _typesPills(W) {
    var BT = (window._bpwConstants && window._bpwConstants.BRAND_TYPES) || {};
    var types = W.brandTypes || [];
    var html = '<div class="bpw-settings-pill-row">';
    [['commercial', 'Commercial'], ['local', 'Local'], ['creator', 'Creator'], ['nonprofit', 'Cause']].forEach(function(t) {
      var checked = types.indexOf(t[0]) !== -1;
      var sub = (BT[t[0]] && BT[t[0]].label) || '';
      html += '<label class="bpw-settings-pill' + (checked ? ' is-on' : '') + '">'
           +  '<input type="checkbox" data-settings-brand-type="' + t[0] + '"' + (checked ? ' checked' : '') + '>'
           +  '<span>' + _esc(t[1]) + (sub ? ' <small>' + _esc(sub) + '</small>' : '') + '</span>'
           +  '</label>';
    });
    html += '</div>';
    return html;
  }

  function _renderPhase(W) {
    var cur = W.brandLevel || 'new';
    var grid = '<div class="bpw-settings-phase-grid">';
    PHASES.forEach(function(p) {
      var isCur = p.key === cur;
      grid += '<button class="bpw-settings-phase-opt' + (isCur ? ' is-current' : '') + '"'
           +  ' data-settings-phase="' + _esc(p.key) + '" type="button"' + (isCur ? ' disabled' : '') + '>'
           +  '<div class="bpw-settings-phase-top">'
           +    '<span class="bpw-settings-phase-emoji">' + p.emoji + '</span>'
           +    '<span class="bpw-settings-phase-name">' + _esc(p.label) + '</span>'
           +    '<span class="bpw-settings-phase-tag">' + (isCur ? 'current' : (_phaseDirection(cur, p.key))) + '</span>'
           +  '</div>'
           +  '<div class="bpw-settings-phase-desc">' + _esc(p.desc) + '</div>'
           +  '</button>';
    });
    grid += '</div>';
    return _section('Growth phase',
      'Decides prompt depth, not which sections you see. All sections stay available at every phase.',
      grid);
  }

  function _phaseDirection(from, to) {
    var order = { 'new': 0, 'growing': 1, 'deep': 2 };
    if (order[to] > order[from]) return 'upgrade';
    return 'downgrade';
  }

  function _renderAI(W) {
    var configured = window.LLMService && window.LLMService.isConfigured();
    var body;
    if (!configured) {
      body = '<div class="bpw-setup-warn">' + _icon('triangle-exclamation') + ' No providers configured. Add credentials in the Drupal AI settings.</div>';
    } else {
      body = '<div class="bpw-settings-row"><label>Provider</label>' + window.LLMService.renderProviderSelect() + '</div>'
           + '<div class="bpw-settings-row"><label>Model</label>' + window.LLMService.renderModelSelect() + '</div>';
    }
    return _section('AI provider & model', 'Applied to every generation.', body);
  }

  function _renderDump(W) {
    var seed = W.seedContext || {};
    var dumpFn = window._bpwAIHelpers && window._bpwAIHelpers.consolidateSeedDump;
    var dump = dumpFn ? dumpFn(seed) : (seed.dump || '');
    var body = '<p class="bpw-settings-help">Single anchor field used by every AI run. Updating here improves every future regeneration. Replaces the old "description" + "custom instructions" pair.</p>'
      +  '<textarea class="bpw-settings-textarea" data-settings-field="dump" rows="10">' + _esc(dump) + '</textarea>';
    return _section('Brand details', 'The secret sauce.', body);
  }

  function _renderRerun() {
    var body = '<p class="bpw-settings-help">Re-opens the autopilot with all stages queued. Existing accepted content stays put — anything you regenerate replaces it once you approve the new version.</p>'
      +  '<button class="bpw-btn bpw-btn-ghost" data-action="re-run-autopilot" type="button">'
      +    _icon('rotate-right') + ' Re-run setup</button>';
    return _section('Re-run setup', null, body);
  }

  function renderList() { return ''; }

  function renderDetail(W) {
    var html = '<section class="bpw-shell-detail bpw-shell-detail--page" aria-label="Settings">';
    html += '<header class="bpw-shell-detail-head"><h1>Settings</h1>'
         +  '<p class="bpw-shell-detail-sub">Brand basics, AI configuration, and growth-phase. Changes here ripple into every future AI run.</p>'
         +  '</header>';
    html += '<div class="bpw-settings-stack">';
    html += _renderBasics(W);
    html += _renderPhase(W);
    html += _renderAI(W);
    html += _renderDump(W);
    html += _renderRerun();
    html += '</div>';
    html += '</section>';
    return html;
  }

  // ── Phase-switch confirmation modal ───────────────────────────────
  function _openPhaseModal(newKey) {
    var W = window._bpwState;
    var cur = W.brandLevel || 'new';
    var order = { 'new': 0, 'growing': 1, 'deep': 2 };
    var isUpgrade = (order[newKey] || 0) > (order[cur] || 0);
    var curPhase = PHASES.find(function(p) { return p.key === cur; });
    var newPhase = PHASES.find(function(p) { return p.key === newKey; });
    if (!newPhase) return;

    var body;
    if (isUpgrade) {
      body = '<p>Upgrading from <strong>' + _esc(curPhase ? curPhase.label : cur) + '</strong>'
           + ' to <strong>' + _esc(newPhase.label) + '</strong> re-runs the relevant stages with deeper prompts. You\'ll review each new draft before it sticks. Your existing approved content stays — the AI <em>adds</em> depth, it doesn\'t overwrite without your approval.</p>';
    } else {
      body = '<p>Downgrading from <strong>' + _esc(curPhase ? curPhase.label : cur) + '</strong>'
           + ' to <strong>' + _esc(newPhase.label) + '</strong> writes the new level but keeps every section\'s existing content. Future AI regenerations will use lighter prompts. No AI runs now.</p>';
    }

    var ctaLabel = isUpgrade ? 'Upgrade & start drafting' : 'Set phase';
    var html = '<div class="bpw-modal-backdrop" data-action="phase-modal-close">'
      +  '<div class="bpw-modal" role="dialog" aria-modal="true">'
      +    '<header class="bpw-modal-head">'
      +      '<span class="bpw-modal-icon">' + _esc(newPhase.emoji) + '</span>'
      +      '<div><h2>' + (isUpgrade ? 'Upgrade to ' : 'Switch to ') + _esc(newPhase.label) + '?</h2>'
      +      '<p class="bpw-modal-sub">' + (isUpgrade ? 'Runs the additional stages with the same per-stage review screens you saw during setup.' : 'Non-destructive — your content stays, prompts get lighter.') + '</p>'
      +      '</div></header>'
      +    '<div class="bpw-modal-body">' + body + '</div>'
      +    '<footer class="bpw-modal-foot">'
      +      '<button class="bpw-btn bpw-btn-ghost" data-action="phase-modal-close" type="button">Cancel</button>'
      +      '<button class="bpw-btn bpw-btn-primary" data-action="phase-modal-confirm" data-phase="' + _esc(newKey) + '" type="button">' + _esc(ctaLabel) + ' →</button>'
      +    '</footer>'
      +  '</div></div>';
    $('body').append(html);
  }

  function _closePhaseModal() { $('.bpw-modal-backdrop').remove(); }

  function _confirmPhase(newKey) {
    var W = window._bpwState;
    var cur = W.brandLevel || 'new';
    var order = { 'new': 0, 'growing': 1, 'deep': 2 };
    var isUpgrade = (order[newKey] || 0) > (order[cur] || 0);
    _closePhaseModal();
    if (isUpgrade && window._bpwSetup && window._bpwSetup.openDelta) {
      window._bpwSetup.openDelta(newKey);
    } else {
      W.brandLevel = newKey;
      if (window._bpwExportSync) window._bpwExportSync.syncAll();
      if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
      if (window._bpwAutoSave) window._bpwAutoSave();
      if (window._bpwAppShell) window._bpwAppShell.render();
      if (window._bpwToast) window._bpwToast('Growth phase set to ' + newKey, 'success');
    }
  }

  // ── Event bindings ─────────────────────────────────────────────────
  $(document).off('input.bpw-settings change.bpw-settings').on('input.bpw-settings change.bpw-settings', '[data-settings-field]', function() {
    var W = window._bpwState;
    var f = $(this).data('settings-field');
    var val = $(this).val();
    if (f === 'name') {
      W.acceptedSections = W.acceptedSections || {};
      W.acceptedSections.identity = W.acceptedSections.identity || {};
      W.acceptedSections.identity.name = val;
    }
    if (f === 'url') {
      W.seedContext = W.seedContext || {};
      W.seedContext.url = val;
    }
    if (f === 'dump') {
      W.seedContext = W.seedContext || {};
      W.seedContext.dump = val;
    }
    if (f === 'language') W.language = val;
    if (window._bpwExportSync) window._bpwExportSync.syncAll();
    if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
    if (window._bpwAutoSave) window._bpwAutoSave();
  });

  $(document).off('change.bpw-settings-types').on('change.bpw-settings-types', '[data-settings-brand-type]', function() {
    var W = window._bpwState;
    var t = $(this).data('settings-brand-type');
    var checked = $(this).is(':checked');
    W.brandTypes = W.brandTypes || [];
    var i = W.brandTypes.indexOf(t);
    if (checked && i === -1) W.brandTypes.push(t);
    if (!checked && i !== -1) W.brandTypes.splice(i, 1);
    if (window._bpwExportSync) window._bpwExportSync.syncAll();
    if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
    if (window._bpwAutoSave) window._bpwAutoSave();
    if (window._bpwAppShell) window._bpwAppShell.render();
  });

  // Phase pill click → confirmation modal → openDelta / direct set.
  $(document).off('click.bpw-settings-phase').on('click.bpw-settings-phase', '[data-settings-phase]', function(e) {
    e.preventDefault();
    var newKey = $(this).data('settings-phase');
    var W = window._bpwState;
    if (!newKey || newKey === (W.brandLevel || 'new')) return;
    _openPhaseModal(newKey);
  });

  $(document).off('click.bpw-phase-modal').on('click.bpw-phase-modal', '[data-action="phase-modal-close"]', function(e) {
    // Only close when the click is on the backdrop itself or the
    // explicit cancel button — not on the modal body.
    if (e.target === e.currentTarget) { _closePhaseModal(); return; }
    if ($(e.target).is('button[data-action="phase-modal-close"]')) _closePhaseModal();
  });

  $(document).off('click.bpw-phase-confirm').on('click.bpw-phase-confirm', '[data-action="phase-modal-confirm"]', function(e) {
    e.preventDefault();
    _confirmPhase($(this).data('phase'));
  });

  $(document).off('click.bpw-rerun').on('click.bpw-rerun', '[data-action="re-run-autopilot"]', function(e) {
    e.preventDefault();
    if (!window._bpwSetup || !window._bpwSetup.forceOpen) return;
    $('body').removeClass('bpw-app-shell-active');
    $('#bpwAppShell').remove();
    window._bpwSetup.forceOpen();
  });

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.settings = {
    id: 'settings',
    title: 'Settings',
    minLevel: 'new',
    listMode: 'none',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
