/**
 * @category    ai
 * @purpose     Provider-agnostic LLM client. Parses the AI config div the
 *              Drupal page exposes, builds a `_providerMap` of (provider →
 *              activeModels), and dispatches `callAI` through whichever
 *              adapter from `window._bpwAIProviders` matches the current
 *              selection.
 *
 *              CRITICAL: this module never touches `W.isAIProcessing`. That
 *              flag is owned by the batch orchestrator (currently
 *              bpw-part2a.js:347-362, later setup/bpw-setup-orchestrator.js).
 *              Touching it here clears the batch guard mid-batch.
 *
 * @exports     window.LLMService
 *                { init, isConfigured, getActiveProviders, getActiveModels,
 *                  callAI, renderPicker, renderProviderSelect, renderModelSelect }
 *
 * @depends-on  window._bpwAIProviders (registry + adapters)
 *              window._bpwState (W) for { aiProvider, aiModel }
 *              window.jQuery for DOM config parsing
 *              window.LOG_PREFIX (legacy '[BPW]'); falls back if absent
 *
 * @extracted-from  src/legacy/bpw-app.js SECTION 23
 */
(function() {
  'use strict';

  var $ = window.jQuery;
  var LOG = '[BPW-ai]';

  var _config = null, _providerMap = {};

  function _decodeEntities(text) {
    if (!text) return '';
    var el = document.createElement('textarea');
    el.innerHTML = text;
    return el.value;
  }

  function _tryParseConfig($el) {
    if (!$el || !$el.length) return null;
    var raw = $el.text();
    if (raw && raw.trim()) {
      try { return JSON.parse(raw.trim()); } catch (e) {}
    }
    raw = $el[0].textContent;
    if (raw && raw.trim()) {
      try { return JSON.parse(raw.trim()); } catch (e) {}
    }
    raw = _decodeEntities($el.html());
    if (raw && raw.trim()) {
      try { return JSON.parse(raw.trim()); } catch (e) {}
    }
    raw = _decodeEntities(_decodeEntities($el.html()));
    if (raw && raw.trim()) {
      try { return JSON.parse(raw.trim()); } catch (e) {}
    }
    console.warn(LOG, 'LLM config parse failed. Raw (first 200):', ($el.text() || '').substring(0, 200));
    return null;
  }

  function init() {
    _config = null; _providerMap = {};

    var configSelectors = [
      '.llm-brand-config-data',
      '.llm-config-data',
      '#llm-config-data',
      '[data-llm-config]',
      'script[type="application/json"][data-llm-config]'
    ];

    var raw = null;
    for (var i = 0; i < configSelectors.length; i++) {
      var $el = $(configSelectors[i]);
      if ($el.length) {
        console.log(LOG, 'LLM config found via:', configSelectors[i]);
        if ($el.is('script')) {
          try { raw = JSON.parse($el.html().trim()); } catch (e) {}
        } else {
          raw = _tryParseConfig($el);
        }
        if (raw) break;
      }
    }

    if (!raw) {
      console.warn(LOG, 'LLM config: not found in DOM, scheduling retry');
      setTimeout(_retryInit, 2000);
      return;
    }

    _processConfig(raw);
  }

  function _retryInit() {
    if (Object.keys(_providerMap).length > 0) return;
    console.log(LOG, 'LLM config: retry');
    var selectors = ['.llm-brand-config-data', '.llm-config-data', '#llm-config-data', '[data-llm-config]'];
    for (var i = 0; i < selectors.length; i++) {
      var $el = $(selectors[i]);
      if ($el.length) {
        var raw = _tryParseConfig($el);
        if (raw) {
          _processConfig(raw);
          // Caller wires re-render via its own flow (boot or setup module).
          return;
        }
      }
    }
    console.warn(LOG, 'LLM config: retry failed. AI features unavailable.');
  }

  function _processConfig(raw) {
    var W = window._bpwState;
    _config = raw;
    if (_config && _config.providers) {
      for (var i = 0; i < _config.providers.length; i++) {
        var p = _config.providers[i];
        if (!p.active) continue;
        var am = (p.models || []).filter(function(m) { return m.active; });
        if (!am.length) continue;
        _providerMap[p.id] = { id: p.id, label: p.label || p.id, api_key: p.api_key || '', activeModels: am };
      }
    }
    if (W && !W.aiProvider) {
      var def = _getDefault();
      if (def) { W.aiProvider = def.provider; W.aiModel = def.model; }
    }
    console.log(LOG, 'LLMService:', Object.keys(_providerMap).length, 'providers configured');
  }

  function isConfigured() { return Object.keys(_providerMap).length > 0; }

  function getActiveProviders() {
    return Object.keys(_providerMap).map(function(id) { return _providerMap[id]; });
  }

  function getActiveModels(pid) {
    var p = _providerMap[pid];
    return p ? p.activeModels : [];
  }

  function _getDefault() {
    var provs = getActiveProviders();
    if (!provs.length) return null;
    if (_config && _config.default_provider && _config.default_model) {
      var p = _providerMap[_config.default_provider];
      if (p) {
        for (var i = 0; i < p.activeModels.length; i++) {
          if (p.activeModels[i].id === _config.default_model) {
            return _resolveModel(p, p.activeModels[i]);
          }
        }
      }
    }
    // Smart fallback: bias toward Gemini Flash variants (free tier +
    // fast), then any Gemini, then any other provider's default. Mirrors
    // the reference repo's _getDefault preference order so users with
    // multiple keys configured land on the cheapest reasonable choice.
    var preferred = _findPreferredFlashModel(provs);
    if (preferred) return preferred;
    var p0 = provs[0], m0 = _pickDefaultModel(p0) || p0.activeModels[0];
    return _resolveModel(p0, m0);
  }

  function _findPreferredFlashModel(provs) {
    var gemini = null;
    for (var i = 0; i < provs.length; i++) {
      if ((provs[i].id || '').toLowerCase() === 'gemini') { gemini = provs[i]; break; }
    }
    if (!gemini) return null;
    var order = [/2\.5.*flash/i, /2\.0.*flash/i, /flash/i];
    for (var k = 0; k < order.length; k++) {
      for (var j = 0; j < gemini.activeModels.length; j++) {
        var m = gemini.activeModels[j];
        if (order[k].test(m.id) || order[k].test(m.label || '')) return _resolveModel(gemini, m);
      }
    }
    return _resolveModel(gemini, _pickDefaultModel(gemini) || gemini.activeModels[0]);
  }

  function _pickDefaultModel(p) {
    if (!p || !p.activeModels) return null;
    for (var i = 0; i < p.activeModels.length; i++) {
      if (p.activeModels[i].is_default) return p.activeModels[i];
    }
    return null;
  }

  function _resolveModel(p, m) {
    return {
      provider: p.id, model: m.id, api_key: p.api_key,
      temperature: m.temperature !== undefined ? m.temperature : 1.0,
      max_tokens: m.max_tokens || 8192
    };
  }

  function _getSelection() {
    var W = window._bpwState;
    var pid = W && W.aiProvider, mid = W && W.aiModel;
    var p = _providerMap[pid];
    if (!p) return _getDefault();
    for (var i = 0; i < p.activeModels.length; i++) {
      if (p.activeModels[i].id === mid) {
        return {
          provider: pid, model: mid, api_key: p.api_key,
          temperature: p.activeModels[i].temperature !== undefined ? p.activeModels[i].temperature : 1.0,
          max_tokens: p.activeModels[i].max_tokens || 8192
        };
      }
    }
    return {
      provider: pid, model: p.activeModels[0].id, api_key: p.api_key,
      temperature: p.activeModels[0].temperature !== undefined ? p.activeModels[0].temperature : 1.0,
      max_tokens: p.activeModels[0].max_tokens || 8192
    };
  }

  function callAI(prompt, onSuccess, onError, systemPrompt) {
    var cfg = _getSelection();
    if (!cfg || !cfg.api_key) { if (onError) onError('No AI providers configured. Go to Settings.'); return; }

    var adapter = window._bpwAIProviders[cfg.provider];
    if (!adapter || typeof adapter.buildRequest !== 'function') {
      if (onError) onError('Unknown provider: ' + cfg.provider);
      return;
    }

    var req;
    try {
      req = adapter.buildRequest(prompt, cfg, systemPrompt || '');
    } catch (e) {
      if (onError) onError('Request build failed: ' + (e.message || e));
      return;
    }

    console.log(LOG, 'AI call:', cfg.provider + '/' + cfg.model);
    // W.isAIProcessing is intentionally NOT touched here — it is owned by
    // the batch orchestrator that called us. See module header.

    fetch(req.endpoint, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) })
      .then(function(res) {
        if (!res.ok) return res.text().then(function(t) {
          var msg = 'API ' + res.status;
          try { msg = JSON.parse(t).error.message || msg; } catch (e) {}
          throw new Error(msg);
        });
        return res.json();
      })
      .then(function(data) {
        var txt = adapter.parseResponse(data);
        console.log(LOG, 'AI response:', (txt || '').substring(0, 200));
        if (onSuccess) onSuccess(txt);
      })
      .catch(function(err) {
        console.error(LOG, 'AI error:', err);
        if (onError) onError(err.message || 'Request failed');
      });
  }

  // ── Renderers ──────────────────────────────────────────────────────
  // Mirror the legacy LLMService renderers so they remain a drop-in
  // replacement. `esc` and `icon` are read off window-globals exported
  // by utils, falling back to inline implementations if absent so this
  // module is self-sufficient during the migration.
  function _esc(s) {
    return (window._bpwEsc || function(x) {
      if (x === null || x === undefined) return '';
      return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    })(s);
  }
  function _icon(n) {
    return (window._bpwIcon || function(name) {
      if (!name) return '';
      if (name.indexOf('fa-') === 0) return '<i class="' + name + '"></i>';
      return '<i class="fa-solid fa-' + name + '"></i>';
    })(n);
  }

  function renderPicker() {
    var W = window._bpwState;
    if (!isConfigured()) return '<span class="bpw-ai-no-config">' + _icon('triangle-exclamation') + ' No AI configured</span>';
    var provs = getActiveProviders();
    var h = '<select class="bpw-header-select" data-field="ai-provider">';
    for (var i = 0; i < provs.length; i++) h += '<option value="' + _esc(provs[i].id) + '"' + (W.aiProvider === provs[i].id ? ' selected' : '') + '>' + _esc(provs[i].label) + '</option>';
    h += '</select>';
    h += '<select class="bpw-header-select" data-field="ai-model">';
    var models = getActiveModels(W.aiProvider);
    for (var j = 0; j < models.length; j++) h += '<option value="' + _esc(models[j].id) + '"' + (W.aiModel === models[j].id ? ' selected' : '') + '>' + _esc(models[j].label || models[j].id) + '</option>';
    h += '</select>';
    return h;
  }

  function renderProviderSelect() {
    var W = window._bpwState;
    if (!isConfigured()) return '<div class="bpw-hint">' + _icon('triangle-exclamation') + ' No AI providers configured</div>';
    var provs = getActiveProviders();
    var h = '<select class="bpw-select" data-field="ai-provider-setup">';
    for (var i = 0; i < provs.length; i++) h += '<option value="' + _esc(provs[i].id) + '"' + (W.aiProvider === provs[i].id ? ' selected' : '') + '>' + _esc(provs[i].label) + '</option>';
    h += '</select>';
    return h;
  }

  function renderModelSelect() {
    var W = window._bpwState;
    var models = getActiveModels(W.aiProvider);
    if (!models.length) return '<select class="bpw-select" disabled><option>No models</option></select>';
    var h = '<select class="bpw-select" data-field="ai-model-setup">';
    for (var j = 0; j < models.length; j++) h += '<option value="' + _esc(models[j].id) + '"' + (W.aiModel === models[j].id ? ' selected' : '') + '>' + _esc(models[j].label || models[j].id) + '</option>';
    h += '</select>';
    return h;
  }

  window.LLMService = {
    init: init,
    isConfigured: isConfigured,
    getActiveProviders: getActiveProviders,
    getActiveModels: getActiveModels,
    callAI: callAI,
    renderPicker: renderPicker,
    renderProviderSelect: renderProviderSelect,
    renderModelSelect: renderModelSelect
  };
})();
