/**
 * @category    ui
 * @purpose     Settings view. fixed-cards mode. Cards: brand basics
 *              (re-editable name + URL), growth phase (re-editable —
 *              upgrade triggers delta-mode autopilot in Phase 4.3),
 *              brand types, language, AI provider/model.
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

  var CARDS = [
    { id: 'basics',       label: 'Brand basics',     icon: 'building'   },
    { id: 'growth',       label: 'Growth phase',     icon: 'arrow-up-right-dots' },
    { id: 'types',        label: 'Brand types',      icon: 'tags'       },
    { id: 'language',     label: 'Language',         icon: 'language'   },
    { id: 'ai',           label: 'AI provider & model', icon: 'robot'   },
    { id: 're-run-setup', label: 'Re-run setup',     icon: 'rotate-right' }
  ];

  function renderList(W) {
    var active = (W.ui && W.ui.itemId) || null;
    var html = '';
    for (var i = 0; i < CARDS.length; i++) {
      var c = CARDS[i];
      var cls = active === c.id ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      html += '<article class="' + cls + '" data-item-id="' + _esc(c.id) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _icon(c.icon) + ' ' + _esc(c.label) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(_snippet(W, c.id)) + '</div>';
      html += '</article>';
    }
    return html;
  }

  function _snippet(W, id) {
    if (id === 'basics')   return (W.acceptedSections && W.acceptedSections.identity && W.acceptedSections.identity.name) || (W.seedContext && W.seedContext.url) || '—';
    if (id === 'growth')   return W.brandLevel || '—';
    if (id === 'types')    return (W.brandTypes || []).join(', ') || '—';
    if (id === 'language') return W.language || 'en';
    if (id === 'ai')       return (W.aiProvider || '—') + (W.aiModel ? ' · ' + W.aiModel : '');
    if (id === 're-run-setup') return 'Re-open the autopilot to regenerate everything.';
    return '';
  }

  function renderDetail(W, selectedId) {
    if (!selectedId) return '';
    if (selectedId === 'basics')   return _renderBasicsCard(W);
    if (selectedId === 'growth')   return _renderGrowthCard(W);
    if (selectedId === 'types')    return _renderTypesCard(W);
    if (selectedId === 'language') return _renderLanguageCard(W);
    if (selectedId === 'ai')       return _renderAICard(W);
    if (selectedId === 're-run-setup') return _renderReRunCard(W);
    return '';
  }

  function _renderBasicsCard(W) {
    var name = (W.acceptedSections && W.acceptedSections.identity && W.acceptedSections.identity.name) || '';
    var url = (W.seedContext && (W.seedContext.url || W.seedContext.website_url)) || '';
    return '<div class="bpw-shell-detail-card">'
      + '<h3>Brand basics</h3>'
      + '<div class="bpw-shell-detail-row"><div class="bpw-shell-detail-label">Brand name</div><input class="bpw-setup-input" data-settings-field="name" type="text" value="' + _esc(name) + '"></div>'
      + '<div class="bpw-shell-detail-row"><div class="bpw-shell-detail-label">Website URL</div><input class="bpw-setup-input" data-settings-field="url" type="url" value="' + _esc(url) + '"></div>'
      + '</div>';
  }

  function _renderGrowthCard(W) {
    var lvl = W.brandLevel || 'new';
    var rows = ['new', 'growing', 'deep'].map(function(p) {
      var labels = { 'new': 'New', 'growing': 'Growing', 'deep': 'Deep dive' };
      var checked = lvl === p ? ' checked' : '';
      return '<label class="bpw-setup-radio"><input type="radio" name="bpw-settings-growth" value="' + p + '"' + checked + '><span>' + _esc(labels[p]) + '</span></label>';
    }).join('');
    return '<div class="bpw-shell-detail-card">'
      + '<h3>Growth phase</h3>'
      + '<p class="bpw-shell-detail-value">Upgrading runs the autopilot for the new stages. Downgrading hides UI sections but keeps all data.</p>'
      + '<div class="bpw-setup-radio-group">' + rows + '</div>'
      + '</div>';
  }

  function _renderTypesCard(W) {
    var BT = (window._bpwConstants && window._bpwConstants.BRAND_TYPES) || {};
    var types = W.brandTypes || [];
    var rows = [['commercial', 'Commercial'], ['local', 'Local'], ['creator', 'Creator'], ['nonprofit', 'Cause']].map(function(t) {
      var checked = types.indexOf(t[0]) !== -1 ? ' checked' : '';
      var sub = (BT[t[0]] && BT[t[0]].label) || '';
      return '<label class="bpw-setup-checkbox"><input type="checkbox" data-settings-brand-type="' + t[0] + '"' + checked + '><span>' + _esc(t[1]) + (sub ? '<small>' + _esc(sub) + '</small>' : '') + '</span></label>';
    }).join('');
    return '<div class="bpw-shell-detail-card">'
      + '<h3>Brand types</h3>'
      + '<div class="bpw-setup-checkbox-group">' + rows + '</div>'
      + '</div>';
  }

  function _renderLanguageCard(W) {
    var LANG = (window._bpwConstants && window._bpwConstants.LANGUAGES) || [{ code: 'en', label: 'English' }];
    var cur = W.language || 'en';
    var opts = LANG.map(function(l) {
      return '<option value="' + _esc(l.code) + '"' + (l.code === cur ? ' selected' : '') + '>' + _esc(l.label) + '</option>';
    }).join('');
    return '<div class="bpw-shell-detail-card">'
      + '<h3>Language</h3>'
      + '<select class="bpw-setup-input" data-settings-field="language">' + opts + '</select>'
      + '</div>';
  }

  function _renderAICard(W) {
    var configured = window.LLMService && window.LLMService.isConfigured();
    if (!configured) {
      return '<div class="bpw-shell-detail-card"><h3>AI provider</h3><div class="bpw-setup-warn">' + _icon('triangle-exclamation') + ' No providers configured. Add credentials in the Drupal AI settings.</div></div>';
    }
    return '<div class="bpw-shell-detail-card">'
      + '<h3>AI provider &amp; model</h3>'
      + '<div class="bpw-shell-detail-row"><div class="bpw-shell-detail-label">Provider</div>' + window.LLMService.renderProviderSelect() + '</div>'
      + '<div class="bpw-shell-detail-row"><div class="bpw-shell-detail-label">Model</div>' + window.LLMService.renderModelSelect() + '</div>'
      + '</div>';
  }

  function _renderReRunCard(W) {
    return '<div class="bpw-shell-detail-card">'
      + '<h3>Re-run setup</h3>'
      + '<p class="bpw-shell-detail-value">Re-opens the autopilot. Existing data stays in place — anything you regenerate replaces it after you accept the new version. Use this when you want to rebuild from scratch.</p>'
      + '<button class="bpw-setup-start" data-action="re-run-autopilot" type="button">' + _icon('rotate-right') + ' Open autopilot</button>'
      + '</div>';
  }

  // ── Event bindings ─────────────────────────────────────────────────
  $(document).off('input.bpw-settings').on('input.bpw-settings', '[data-settings-field]', function() {
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

  // Growth-phase change → delta mode (Phase 4.3 wires the actual flow).
  $(document).off('change.bpw-settings-growth').on('change.bpw-settings-growth', '[name="bpw-settings-growth"]', function() {
    var W = window._bpwState;
    var newLevel = $(this).val();
    var oldLevel = W.brandLevel;
    if (newLevel === oldLevel) return;
    var levelOrder = (window._bpwConstants && window._bpwConstants.LEVEL_ORDER) || { 'new': 0, 'growing': 1, 'deep': 2 };
    var newRank = levelOrder[newLevel] || 0;
    var oldRank = levelOrder[oldLevel] || 0;
    if (newRank > oldRank && window._bpwSetup && window._bpwSetup.openDelta) {
      window._bpwSetup.openDelta(newLevel);
    } else {
      // Downgrade or same level → preserve data, just re-render.
      W.brandLevel = newLevel;
      if (window._bpwExportSync) window._bpwExportSync.syncAll();
      if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
      if (window._bpwAutoSave) window._bpwAutoSave();
      if (window._bpwAppShell) window._bpwAppShell.render();
      if (window._bpwToast) window._bpwToast('Growth phase set to ' + newLevel, 'success');
    }
  });

  // Re-run autopilot from settings. openIfFirstRun bails on existing
  // profiles, so we use forceOpen which queues the full stage list and
  // mounts the takeover regardless of accepted data.
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
    listMode: 'fixed-cards',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
