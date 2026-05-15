/**
 * @category    setup
 * @purpose     Autopilot UI shell. Renders a takeover view with the
 *              setup form on top and a stage rail below. Drives the
 *              orchestrator on form submit.
 *
 *              While open, body.bpw-setup-open hides the legacy
 *              wizard via CSS so the autopilot reads as its own surface.
 *              On completion, the takeover hides; the legacy wizard
 *              re-renders showing the review screen for the data the
 *              autopilot produced. Phase 4 replaces the legacy wizard
 *              with the three-pane app shell.
 *
 * @exports     window._bpwSetup
 *                = { openIfFirstRun, openDelta, close, render }
 *
 * @depends-on  window._bpwState, window._bpwConstants (BRAND_TYPES),
 *              window.LLMService, window.BrandService,
 *              window._bpwSetupStages, window._bpwSetupOrchestrator,
 *              jQuery
 */
(function() {
  'use strict';

  var $ = window.jQuery;
  var LOG = '[BPW-setup]';
  var W;
  var _bootPollCount = 0;

  // ── BOOT ────────────────────────────────────────────────────────────
  // Poll for legacy Part 1 init so W is populated.
  var _bootTimer = setInterval(function() {
    _bootPollCount++;
    if (window._bpwState && window._bpwState.initialized) {
      clearInterval(_bootTimer);
      _init();
      return;
    }
    if (_bootPollCount > 300) {
      clearInterval(_bootTimer);
      console.warn(LOG, 'gave up waiting for Part 1');
    }
  }, 100);

  function _init() {
    W = window._bpwState;
    if (window.LLMService && !window.LLMService.isConfigured()) {
      try { window.LLMService.init(); } catch (e) { console.warn(LOG, 'LLMService.init() threw', e); }
    }
    if (window.BrandService && window.BrandService.init) {
      try { window.BrandService.init(); } catch (e) {}
    }

    _wireEvents();
    openIfFirstRun();
    console.log(LOG, 'ready');
  }

  function openIfFirstRun() {
    if (!W) return;
    if (W.setup && W.setup.finishedAt) return;          // already completed
    if (W.setup && W.setup.open) { _render(); return; } // mid-run
    var accepted = W.acceptedSections || {};
    if (Object.keys(accepted).length > 0) return;       // existing profile — let legacy handle
    _open();
  }

  function openDelta(newLevel) {
    if (!W) return;
    var stagesMod = window._bpwSetupStages;
    if (!stagesMod) return;
    var oldLevel = W.brandLevel;
    var delta = stagesMod.diffStages(oldLevel, newLevel, W.brandTypes || []);
    if (!delta.length) {
      W.brandLevel = newLevel;
      if (window._bpwRender) window._bpwRender();
      return;
    }
    W.brandLevel = newLevel;
    _open({ mode: 'delta', queueIds: delta });
  }

  function close() {
    $('.bpw-setup').remove();
    $('body').removeClass('bpw-setup-open');
  }

  // ── INTERNAL ────────────────────────────────────────────────────────
  function _open(opts) {
    opts = opts || {};
    if (opts.queueIds) {
      _startAutopilot(opts.queueIds, opts.mode || 'delta');
    }
    _render();
  }

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
  function _fmtElapsed(ms) {
    if (!ms || ms < 0) return '0s';
    var s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60), rem = s % 60;
    return (m < 10 ? '0' + m : m) + ':' + (rem < 10 ? '0' + rem : rem);
  }

  // ── RENDER ──────────────────────────────────────────────────────────
  function _render() {
    $('body').addClass('bpw-setup-open');
    var $existing = $('.bpw-setup');
    var html = _renderShell();
    if ($existing.length) {
      // Preserve scroll & focus where possible — replace innerHTML only.
      $existing.html($(html).html());
    } else {
      $('body').append('<div class="bpw-setup" role="application" aria-label="Brand profile autopilot setup">' + html + '</div>');
    }
  }

  function _renderShell() {
    var running = W.setup && W.setup.open;
    return _renderTopbar(running) + _renderBody(running);
  }

  function _renderTopbar(running) {
    var elapsed = running ? _fmtElapsed(W.setup.totalElapsedMs + (W.setup.startedAt ? (Date.now() - W.setup.startedAt) : 0)) : '';
    var total = running ? W.setup.stagesQueue.length : 0;
    var done = 0;
    if (running) {
      for (var i = 0; i < W.setup.stagesQueue.length; i++) {
        var st = (W.setup.stageStatus[W.setup.stagesQueue[i]] || {}).state;
        if (st === 'done' || st === 'skipped') done++;
      }
    }
    var pct = total ? Math.round((done / total) * 100) : 0;

    var html = '<header class="bpw-setup-topbar">';
    html += '<div class="bpw-setup-topbar-brand">' + _icon('sparkles') + '<div class="bpw-setup-topbar-titles">';
    html += '<div class="bpw-setup-topbar-title">Brand profile autopilot</div>';
    html += '<div class="bpw-setup-topbar-sub">' + (running ? 'Stage ' + Math.min(done + 1, total) + ' of ' + total : 'Set up your brand') + '</div>';
    html += '</div></div>';

    if (running) {
      html += '<div class="bpw-setup-topbar-progress">';
      html += '<span class="bpw-setup-elapsed">' + _esc(elapsed) + '</span>';
      html += '<div class="bpw-setup-progress-bar"><span style="width:' + pct + '%"></span></div>';
      html += '<span class="bpw-setup-progress-count">' + done + ' of ' + total + '</span>';
      var paused = W.setup.paused;
      html += '<button class="bpw-setup-pause" data-action="bpw-setup-pause" type="button">' + _icon(paused ? 'play' : 'pause') + ' ' + (paused ? 'Resume' : 'Pause') + '</button>';
      html += '</div>';
    }
    html += '</header>';
    return html;
  }

  function _renderBody(running) {
    var html = '<div class="bpw-setup-body">';
    html += _renderForm(running);
    if (running) html += _renderRail();
    html += '</div>';
    return html;
  }

  function _renderForm(running) {
    var BT = (window._bpwConstants && window._bpwConstants.BRAND_TYPES) || {};
    var lvl = W.brandLevel || 'new';
    var seed = W.seedContext || {};
    var name = (W.acceptedSections && W.acceptedSections.identity && W.acceptedSections.identity.name) || seed.name || '';
    var url = seed.url || seed.website_url || '';
    var types = W.brandTypes || [];
    var disabled = running ? ' disabled' : '';

    var html = '<section class="bpw-setup-form' + (running ? ' bpw-setup-form-locked' : '') + '">';
    html += '<h2 class="bpw-setup-form-title">' + (running ? 'Setup details' : 'Set up your brand profile') + '</h2>';
    if (!running) {
      html += '<p class="bpw-setup-form-desc">Paste your website. AI handles the rest — you review.</p>';
    }

    // Website URL
    html += '<div class="bpw-setup-field">';
    html += '<label for="bpw-setup-url">Website URL</label>';
    html += '<input id="bpw-setup-url" class="bpw-setup-input" data-field="url" type="url" placeholder="https://example.com" value="' + _esc(url) + '"' + disabled + '>';
    html += '</div>';

    // Brand name
    html += '<div class="bpw-setup-field">';
    html += '<label for="bpw-setup-name">Brand name</label>';
    html += '<input id="bpw-setup-name" class="bpw-setup-input" data-field="name" type="text" placeholder="e.g. Acme Studio" value="' + _esc(name) + '"' + disabled + '>';
    html += '</div>';

    // Growth phase (radio)
    html += '<div class="bpw-setup-field">';
    html += '<label>Growth phase</label>';
    html += '<div class="bpw-setup-radio-group">';
    [['new', 'New'], ['growing', 'Growing'], ['deep', 'Deep dive']].forEach(function(p) {
      var checked = lvl === p[0] ? ' checked' : '';
      html += '<label class="bpw-setup-radio"><input type="radio" name="bpw-growth" value="' + p[0] + '"' + checked + disabled + '><span>' + _esc(p[1]) + '</span></label>';
    });
    html += '</div></div>';

    // Brand types (checkboxes)
    html += '<div class="bpw-setup-field">';
    html += '<label>Brand types</label>';
    html += '<div class="bpw-setup-checkbox-group">';
    [['commercial', 'Commercial'], ['local', 'Local'], ['creator', 'Creator'], ['nonprofit', 'Cause']].forEach(function(t) {
      var checked = types.indexOf(t[0]) !== -1 ? ' checked' : '';
      var labelOverride = (BT[t[0]] && BT[t[0]].label) || t[1];
      html += '<label class="bpw-setup-checkbox"><input type="checkbox" data-brand-type="' + t[0] + '"' + checked + disabled + '><span>' + _esc(t[1]) + '<small>' + _esc(labelOverride) + '</small></span></label>';
    });
    html += '</div></div>';

    // AI provider + model
    var configured = window.LLMService && window.LLMService.isConfigured();
    html += '<div class="bpw-setup-field bpw-setup-field-ai">';
    html += '<label>AI provider &amp; model</label>';
    if (configured) {
      html += '<div class="bpw-setup-ai-selects">';
      html += window.LLMService.renderProviderSelect();
      html += window.LLMService.renderModelSelect();
      html += '</div>';
    } else {
      html += '<div class="bpw-setup-warn">' + _icon('triangle-exclamation') + ' No AI providers configured — add credentials in Drupal AI settings.</div>';
    }
    html += '</div>';

    if (!running) {
      var disabledStart = configured ? '' : ' disabled';
      html += '<div class="bpw-setup-actions">';
      html += '<button class="bpw-setup-start" data-action="bpw-setup-start" type="button"' + disabledStart + '>' + _icon('play') + ' Start autopilot</button>';
      html += '</div>';
    }
    html += '</section>';
    return html;
  }

  function _renderRail() {
    var stagesMod = window._bpwSetupStages;
    if (!stagesMod) return '';
    var queue = W.setup.stagesQueue || [];
    var html = '<section class="bpw-setup-rail">';
    html += '<h3 class="bpw-setup-rail-title">' + _icon('list-check') + ' Autopilot stages</h3>';

    for (var i = 0; i < queue.length; i++) {
      var id = queue[i];
      var stage = stagesMod.findStage(id);
      var status = W.setup.stageStatus[id] || { state: 'queued' };
      html += _renderRailItem(stage, status);
    }
    html += '</section>';
    return html;
  }

  function _renderRailItem(stage, status) {
    if (!stage) return '';
    var iconMap = { queued: 'circle', running: 'spinner fa-spin', done: 'circle-check', failed: 'triangle-exclamation', skipped: 'forward' };
    var elapsed = '';
    if (status.state === 'running' && status.startedAt) {
      elapsed = ' · ' + _fmtElapsed(Date.now() - status.startedAt);
    } else if (status.elapsedMs) {
      elapsed = ' · ' + _fmtElapsed(status.elapsedMs);
    }
    var summaryFn = status.state === 'done' ? stage.summary : stage.summaryLine;
    var summary = '';
    try { summary = summaryFn ? summaryFn(W) : ''; } catch (e) { summary = ''; }

    var html = '<article class="bpw-setup-stage bpw-setup-stage--' + status.state + '" data-stage-id="' + _esc(stage.id) + '">';
    html += '<div class="bpw-setup-stage-head">';
    html += '<span class="bpw-setup-stage-icon">' + _icon(iconMap[status.state] || 'circle') + '</span>';
    html += '<div class="bpw-setup-stage-titles">';
    html += '<div class="bpw-setup-stage-label">' + _esc(stage.label) + '</div>';
    html += '<div class="bpw-setup-stage-status">' + _esc(status.state) + elapsed + '</div>';
    html += '</div>';
    if (status.state === 'done' || status.state === 'failed') {
      html += '<button class="bpw-setup-stage-expand" data-action="bpw-setup-expand" data-stage-id="' + _esc(stage.id) + '" type="button" aria-expanded="false">' + _icon('chevron-down') + ' Edit</button>';
    }
    html += '</div>';
    if (summary) html += '<div class="bpw-setup-stage-summary">' + _esc(summary) + '</div>';
    if (status.state === 'failed' && status.error) {
      html += '<div class="bpw-setup-stage-error">' + _icon('triangle-exclamation') + ' ' + _esc(status.error) + '</div>';
      html += '<div class="bpw-setup-stage-actions">';
      html += '<button class="bpw-setup-stage-recover" data-action="bpw-setup-recover" data-stage-id="' + _esc(stage.id) + '" type="button">' + _icon('rotate-right') + ' Recover</button>';
      html += '<button class="bpw-setup-stage-skip" data-action="bpw-setup-skip" data-stage-id="' + _esc(stage.id) + '" type="button">Skip</button>';
      html += '</div>';
    }
    html += '<div class="bpw-setup-stage-expansion" hidden></div>';
    html += '</article>';
    return html;
  }

  // ── EVENTS ──────────────────────────────────────────────────────────
  function _wireEvents() {
    var ns = '.bpw-setup';

    $(document).off('input' + ns, '.bpw-setup [data-field]')
      .on('input' + ns, '.bpw-setup [data-field]', function() {
        var field = $(this).data('field');
        W.seedContext = W.seedContext || {};
        if (field === 'url')  W.seedContext.url  = $(this).val();
        if (field === 'name') {
          W.seedContext.name = $(this).val();
          // Mirror into acceptedSections.identity.name so downstream
          // prompts see it via BrandService.getIdentity().
          W.acceptedSections = W.acceptedSections || {};
          W.acceptedSections.identity = W.acceptedSections.identity || {};
          W.acceptedSections.identity.name = $(this).val();
        }
      });

    $(document).off('change' + ns, '.bpw-setup [name="bpw-growth"]')
      .on('change' + ns, '.bpw-setup [name="bpw-growth"]', function() {
        W.brandLevel = $(this).val();
      });

    $(document).off('change' + ns, '.bpw-setup [data-brand-type]')
      .on('change' + ns, '.bpw-setup [data-brand-type]', function() {
        var t = $(this).data('brand-type');
        var checked = $(this).is(':checked');
        W.brandTypes = W.brandTypes || [];
        var i = W.brandTypes.indexOf(t);
        if (checked && i === -1) W.brandTypes.push(t);
        if (!checked && i !== -1) W.brandTypes.splice(i, 1);
      });

    $(document).off('change' + ns, '.bpw-setup [data-field="ai-provider-setup"]')
      .on('change' + ns, '.bpw-setup [data-field="ai-provider-setup"]', function() {
        W.aiProvider = $(this).val();
        // Pick the first model of the new provider.
        var models = window.LLMService.getActiveModels(W.aiProvider);
        if (models && models[0]) W.aiModel = models[0].id;
        _render();
      });

    $(document).off('change' + ns, '.bpw-setup [data-field="ai-model-setup"]')
      .on('change' + ns, '.bpw-setup [data-field="ai-model-setup"]', function() {
        W.aiModel = $(this).val();
      });

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-start"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-start"]', function(e) {
        e.preventDefault();
        if (!(W.brandTypes && W.brandTypes.length)) {
          alert('Pick at least one brand type.');
          return;
        }
        if (!(W.seedContext && (W.seedContext.url || W.seedContext.name))) {
          alert('Provide a website URL or a brand name.');
          return;
        }
        var queue = window._bpwSetupStages.stagesFor(W.brandLevel || 'new', W.brandTypes || []);
        if (!queue.length) {
          alert('No stages apply to the selected growth phase + types. Pick at least one type that matches.');
          return;
        }
        _startAutopilot(queue, 'initial');
      });

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-pause"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-pause"]', function(e) {
        e.preventDefault();
        var orch = window._bpwSetupOrchestrator;
        if (!orch) return;
        if (W.setup && W.setup.paused) orch.resume(); else orch.pause();
        _render();
      });

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-recover"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-recover"]', function(e) {
        e.preventDefault();
        window._bpwSetupOrchestrator && window._bpwSetupOrchestrator.recoverCurrent();
        _render();
      });

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-skip"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-skip"]', function(e) {
        e.preventDefault();
        window._bpwSetupOrchestrator && window._bpwSetupOrchestrator.skipCurrent();
        _render();
      });

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-expand"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-expand"]', function(e) {
        e.preventDefault();
        var id = $(this).data('stage-id');
        var stage = window._bpwSetupStages.findStage(id);
        var $row = $(this).closest('.bpw-setup-stage');
        var $exp = $row.find('.bpw-setup-stage-expansion');
        var open = $exp.is(':visible');
        if (open) {
          $exp.attr('hidden', true).hide();
          $(this).attr('aria-expanded', 'false');
        } else {
          $exp.html((stage && stage.expandRenderer && stage.expandRenderer(W)) || '<div class="bpw-setup-stage-detail">No details.</div>');
          $exp.removeAttr('hidden').show();
          $(this).attr('aria-expanded', 'true');
        }
      });
  }

  function _startAutopilot(queueIds, mode) {
    var orch = window._bpwSetupOrchestrator;
    if (!orch) {
      console.error(LOG, 'orchestrator missing');
      return;
    }
    orch.start(queueIds, {
      mode: mode,
      onStageEnter: function() { _render(); },
      onStageExit:  function() { _render(); },
      onFinish:     function() {
        _render();
        setTimeout(function() {
          close();
          if (window._bpwRender) window._bpwRender();
          if (window._bpwToast) window._bpwToast('Autopilot complete — review your brand profile.', 'success');
        }, 800);
      }
    });
  }

  window._bpwSetup = {
    openIfFirstRun: openIfFirstRun,
    openDelta: openDelta,
    close: close,
    render: _render
  };
})();
