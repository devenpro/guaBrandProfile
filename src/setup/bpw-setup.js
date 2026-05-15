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
  // Poll for legacy Part 1 init so W is populated. Legacy intentionally
  // skips init on non-brand-profile pages (no textarea, wrong content
  // type, etc.) — those are not failures, so we exit quietly.
  var _bootTimer = setInterval(function() {
    _bootPollCount++;
    if (window._bpwState && window._bpwState.initialized) {
      clearInterval(_bootTimer);
      _init();
      return;
    }
    if (_bootPollCount > 300) {
      clearInterval(_bootTimer);
      // Only complain if this looks like it should have worked. On
      // non-brand-profile pages legacy bails silently, which is correct.
      var bodyClass = (document.body && document.body.className) || '';
      var looksLikeBP = bodyClass.indexOf('brand-profile') !== -1 || bodyClass.indexOf('brand_profile') !== -1;
      if (looksLikeBP) {
        console.error(LOG, 'Wizard never initialised — check the JSON textarea and console for legacy errors.');
      }
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

  // Forces the autopilot open even when an existing profile is present
  // (openIfFirstRun bails on existing profiles). Used by Settings →
  // Re-run setup. Computes the full stage queue for the current level.
  function forceOpen() {
    if (!W) return;
    var stagesMod = window._bpwSetupStages;
    if (!stagesMod) return;
    var queue = stagesMod.stagesFor(W.brandLevel || 'new', W.brandTypes || []);
    if (!queue.length) {
      if (window._bpwToast) window._bpwToast('No stages match the current growth phase + brand types.', 'warning');
      return;
    }
    if (W.setup) W.setup.finishedAt = null;
    _open({ mode: 'initial', queueIds: queue });
  }

  function openDelta(newLevel) {
    if (!W) return;
    var stagesMod = window._bpwSetupStages;
    if (!stagesMod) return;
    var oldLevel = W.brandLevel;
    var delta = stagesMod.diffStages(oldLevel, newLevel, W.brandTypes || []);
    W.brandLevel = newLevel;

    // No new stages to run — just persist the level change and re-render.
    if (!delta.length) {
      if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
      if (window._bpwAutoSave) window._bpwAutoSave();
      if (window._bpwAppShell && window._bpwAppShell.render) {
        window._bpwAppShell.render();
      } else if (window._bpwRender) {
        window._bpwRender();
      }
      if (window._bpwToast) window._bpwToast('Growth phase set to ' + newLevel + ' — no new stages needed.', 'info');
      return;
    }

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
      // _renderShell() returns multiple top-level elements (header + body).
      // Pass the raw string to .html() so jQuery sets innerHTML directly;
      // wrapping with $(html) and calling .html() would only return the
      // first element's children and silently drop the rest.
      $existing.html(html);
    } else {
      $('body').append('<div class="bpw-setup" role="application" aria-label="Brand profile autopilot setup">' + html + '</div>');
    }
  }

  function _renderShell() {
    var running = W.setup && W.setup.open;
    return _renderTopbar(running) + _renderBody(running);
  }

  // Derive which of the three workflow stages we're in.
  //   inputs   → user is filling in basics / hasn't started, OR is between
  //              autopilot runs with no review gate active
  //   website  → autopilot paused at the scrape review gate; user reviews
  //              extracted summary + socials before AI runs continue
  //   ai_run   → autopilot running through the rest of the queue
  //   done     → setup finished (the shell will close shortly after)
  function _workflowStage() {
    var s = W.setup || {};
    if (s.finishedAt) return 'done';
    if (!s.open) return 'inputs';
    if (s.awaitingReview === 'scrape') return 'website';
    if (s.currentStageId === 'scrape') return 'website';
    return 'ai_run';
  }

  var WORKFLOW_STAGES = [
    { id: 'inputs',  label: 'Initial inputs', sub: 'Brand basics, growth phase, AI provider', icon: 'pen-to-square' },
    { id: 'website', label: 'Website & socials', sub: 'Review what the AI extracted, edit socials', icon: 'globe' },
    { id: 'ai_run',  label: 'AI auto-run', sub: 'Identity, audience, content, SEO', icon: 'robot' }
  ];

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
      // Close button — only visible while paused, so users have a
      // clean escape hatch. Confirm before exiting so partial AI
      // output isn't lost accidentally.
      if (paused) {
        html += '<button class="bpw-setup-pause" data-action="bpw-setup-exit" type="button">' + _icon('xmark') + ' Exit</button>';
      }
      html += '</div>';
    }
    html += '</header>';
    return html;
  }

  function _renderBody(running) {
    var stage = _workflowStage();
    var html = '<div class="bpw-setup-body bpw-setup-body--workflow">';
    html += _renderLeftRail(stage);
    html += '<div class="bpw-setup-main">';
    if (stage === 'inputs') {
      html += _renderForm(running);
    } else if (stage === 'website') {
      html += _renderWebsiteStage();
    } else {
      // ai_run / done — AI stage rail with the form collapsed as a
      // context card so users can still see (and refine) the inputs.
      html += _renderAIRunStage();
    }
    html += '</div></div>';
    return html;
  }

  function _renderLeftRail(currentStageId) {
    var s = W.setup || {};
    var html = '<aside class="bpw-setup-leftrail" aria-label="Setup workflow">';
    html += '<div class="bpw-setup-leftrail-title">Setup workflow</div>';
    for (var i = 0; i < WORKFLOW_STAGES.length; i++) {
      var ws = WORKFLOW_STAGES[i];
      var state = 'queued';
      if (ws.id === currentStageId) {
        state = (currentStageId === 'ai_run' && s.paused) ? 'paused' : 'active';
      } else {
        // Order: inputs(0) < website(1) < ai_run(2). Anything before
        // the current stage is done; anything after is queued.
        var currentIdx = -1;
        for (var j = 0; j < WORKFLOW_STAGES.length; j++) {
          if (WORKFLOW_STAGES[j].id === currentStageId) { currentIdx = j; break; }
        }
        if (i < currentIdx) state = 'done';
      }
      var iconName = state === 'done' ? 'circle-check'
                   : state === 'active' ? ws.icon
                   : state === 'paused' ? 'pause'
                   : 'circle';
      html += '<div class="bpw-setup-leftrail-item bpw-setup-leftrail-item--' + state + '">';
      html += '<span class="bpw-setup-leftrail-icon">' + _icon(iconName) + '</span>';
      html += '<div class="bpw-setup-leftrail-text">';
      html += '<div class="bpw-setup-leftrail-label">' + _esc(ws.label) + '</div>';
      html += '<div class="bpw-setup-leftrail-sub">' + _esc(ws.sub) + '</div>';
      html += '</div>';
      html += '</div>';
    }
    html += '</aside>';
    return html;
  }

  function _renderWebsiteStage() {
    // Phase 2 of the workflow: scrape is done (paused awaiting review).
    // Show extracted summary + editable social profiles + the inputs
    // form so users can refine + re-run scrape if anything is off.
    var web = ((W.importedAssets || {}).website) || {};
    var ex = web.extracted || {};
    var html = '<section class="bpw-setup-stage-pane">';
    html += '<header class="bpw-setup-pane-header">';
    html += '<h2 class="bpw-setup-pane-title">' + _icon('globe') + ' Website &amp; socials</h2>';
    html += '<p class="bpw-setup-pane-desc">We analysed your website. Confirm the basics below and edit any social profiles we missed before the AI builds the rest of your brand profile.</p>';
    html += '</header>';

    // Extracted summary card (read-only — the inputs form below is where
    // users edit context and re-run scrape).
    html += '<div class="bpw-setup-extract-card">';
    html += '<h3 class="bpw-setup-extract-title">' + _icon('clipboard-list') + ' What we extracted</h3>';
    html += _renderExtractRow('Tagline', ex.tagline);
    html += _renderExtractRow('Description', ex.description);
    html += _renderExtractRow('Target audience', ex.target_audience);
    html += _renderExtractRow('Detected tone', ex.tone_detected);
    html += _renderExtractRow('Offerings', (ex.offerings || []).filter(Boolean).join(', '));
    html += _renderExtractRow('Key messages', (ex.key_messages || []).filter(Boolean).join(' · '));
    html += _renderExtractRow('Content themes', (ex.content_themes || []).filter(Boolean).join(', '));
    html += '</div>';

    // Social profiles editor.
    html += _renderSocialsEditor(ex.social_profiles || []);

    // Review actions (Continue / Re-run / Skip).
    html += '<div class="bpw-setup-pane-actions">';
    html += '<button class="bpw-setup-review-continue" data-action="bpw-setup-continue-review" type="button">' + _icon('arrow-right') + ' Continue to AI auto-run</button>';
    html += '<button class="bpw-setup-review-rerun" data-action="bpw-setup-rerun-stage" data-stage-id="scrape" type="button">' + _icon('rotate-right') + ' Re-run with my edits</button>';
    html += '<button class="bpw-setup-review-skip" data-action="bpw-setup-skip-review" data-stage-id="scrape" type="button">' + _icon('forward') + ' Skip — use my inputs only</button>';
    html += '</div>';
    html += '</section>';

    // Inputs form as a refinement card. The form sets W.seedContext.*
    // via the existing [data-field] input handler — re-running scrape
    // picks the latest values up.
    html += '<details class="bpw-setup-context-card" open>';
    html += '<summary>' + _icon('pen-to-square') + ' Refine brand context</summary>';
    html += _renderForm(true);
    html += '</details>';

    return html;
  }

  function _renderExtractRow(label, value) {
    var v = value && String(value).trim() ? String(value) : '—';
    return '<div class="bpw-setup-extract-row">'
      +    '<span class="bpw-setup-extract-label">' + _esc(label) + '</span>'
      +    '<span class="bpw-setup-extract-value">' + _esc(v) + '</span>'
      +    '</div>';
  }

  function _renderSocialsEditor(profiles) {
    profiles = profiles || [];
    var PLATFORMS = ['youtube', 'instagram', 'linkedin', 'twitter_x', 'facebook', 'tiktok', 'google_business', 'other'];
    var html = '<div class="bpw-setup-socials">';
    html += '<div class="bpw-setup-socials-header">';
    html += '<h3 class="bpw-setup-socials-title">' + _icon('share-nodes') + ' Social profiles</h3>';
    html += '<button class="bpw-setup-socials-add" data-action="bpw-setup-social-add" type="button">' + _icon('plus') + ' Add profile</button>';
    html += '</div>';

    if (!profiles.length) {
      html += '<p class="bpw-setup-socials-empty">No social profiles detected. Add the ones we missed.</p>';
    } else {
      html += '<div class="bpw-setup-socials-list">';
      for (var i = 0; i < profiles.length; i++) {
        var p = profiles[i] || {};
        html += '<div class="bpw-setup-socials-row" data-social-idx="' + i + '">';
        html += '<select class="bpw-setup-socials-platform" data-social-field="platform">';
        for (var k = 0; k < PLATFORMS.length; k++) {
          var key = PLATFORMS[k];
          html += '<option value="' + key + '"' + (p.platform === key ? ' selected' : '') + '>' + _esc(_platformLabel(key)) + '</option>';
        }
        html += '</select>';
        html += '<input class="bpw-setup-socials-handle" data-social-field="handle" type="text" placeholder="@handle" value="' + _esc(p.handle || '') + '">';
        html += '<input class="bpw-setup-socials-url" data-social-field="url" type="url" placeholder="https://…" value="' + _esc(p.url || '') + '">';
        html += '<button class="bpw-setup-socials-remove" data-action="bpw-setup-social-remove" type="button" title="Remove">' + _icon('trash') + '</button>';
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function _platformLabel(key) {
    var map = {
      youtube: 'YouTube', instagram: 'Instagram', linkedin: 'LinkedIn',
      twitter_x: 'X (Twitter)', facebook: 'Facebook', tiktok: 'TikTok',
      google_business: 'Google Business', other: 'Other'
    };
    return map[key] || key;
  }

  function _renderAIRunStage() {
    var html = '';
    html += _renderRail();
    // Inputs form collapsed as context so users can still see basics
    // (and refine them at any future review gate).
    html += '<details class="bpw-setup-context-card">';
    html += '<summary>' + _icon('pen-to-square') + ' Brand context</summary>';
    html += _renderForm(true);
    html += '</details>';
    return html;
  }

  function _renderForm(running) {
    var BT = (window._bpwConstants && window._bpwConstants.BRAND_TYPES) || {};
    var lvl = W.brandLevel || 'new';
    var seed = W.seedContext || {};
    var name = (W.acceptedSections && W.acceptedSections.identity && W.acceptedSections.identity.name) || seed.name || '';
    var url = seed.url || seed.website_url || '';
    var description = seed.description || '';
    var customInstructions = seed.customInstructions || '';
    var types = W.brandTypes || [];
    var awaiting = (W.setup && W.setup.awaitingReview) || null;
    // Form inputs stay editable while paused for review so the user can
    // refine context before re-running. They lock again once the user
    // hits Continue and the next stage starts.
    var locked = running && !awaiting;
    var disabled = locked ? ' disabled' : '';

    var html = '<section class="bpw-setup-form' + (locked ? ' bpw-setup-form-locked' : '') + '">';

    // ── Header ────────────────────────────────────────────────────────
    html += '<header class="bpw-setup-form-header">';
    html += '<h2 class="bpw-setup-form-title">' + (running ? 'Brand setup details' : 'Set up your brand profile') + '</h2>';
    if (!running) {
      html += '<p class="bpw-setup-form-desc">Tell us about your brand. The more context you give, the better the AI output — generic URLs alone usually produce generic results.</p>';
    } else if (awaiting) {
      html += '<p class="bpw-setup-form-desc">Refine the details below and re-run the current step, or continue if the extracted data already looks right.</p>';
    }
    html += '</header>';

    // ── Section: Brand basics ─────────────────────────────────────────
    html += '<div class="bpw-setup-section">';
    html += '<h3 class="bpw-setup-section-title">' + _icon('id-card') + ' Brand basics</h3>';

    html += '<div class="bpw-setup-field">';
    html += '<label for="bpw-setup-name">Brand name</label>';
    html += '<input id="bpw-setup-name" class="bpw-setup-input" data-field="name" type="text" placeholder="e.g. Acme Studio" value="' + _esc(name) + '"' + disabled + '>';
    html += '</div>';

    html += '<div class="bpw-setup-field">';
    html += '<label for="bpw-setup-url">Website URL <span class="bpw-setup-field-hint">optional but helpful</span></label>';
    html += '<input id="bpw-setup-url" class="bpw-setup-input" data-field="url" type="url" placeholder="https://example.com" value="' + _esc(url) + '"' + disabled + '>';
    html += '<p class="bpw-setup-help">' + _icon('circle-info') + ' Many AI models can\'t actually open this URL — if results look generic, paste real details below instead.</p>';
    html += '</div>';

    html += '<div class="bpw-setup-field">';
    html += '<label for="bpw-setup-description">What does your brand do? <span class="bpw-setup-field-hint">1–2 sentences</span></label>';
    html += '<textarea id="bpw-setup-description" class="bpw-setup-textarea" data-field="description" rows="2" placeholder="e.g. Acme Studio designs and sells handmade ceramic homeware for small modern kitchens."' + disabled + '>' + _esc(description) + '</textarea>';
    html += '</div>';

    html += '<div class="bpw-setup-field">';
    html += '<label for="bpw-setup-custom-instructions">Custom instructions <span class="bpw-setup-field-hint">paste anything that matters</span></label>';
    html += '<textarea id="bpw-setup-custom-instructions" class="bpw-setup-textarea bpw-setup-textarea-tall" data-field="customInstructions" rows="6" placeholder="Anything that should anchor the AI — your About page copy, key product names, target customer, tone you want, things to avoid, competitors, awards, etc. The richer this is, the better."' + disabled + '>' + _esc(customInstructions) + '</textarea>';
    html += '<p class="bpw-setup-help">' + _icon('lightbulb') + ' Treat this like a brief for a junior strategist — facts the AI couldn\'t know otherwise.</p>';
    html += '</div>';

    html += '</div>'; // /bpw-setup-section

    // ── Section: Goals ────────────────────────────────────────────────
    html += '<div class="bpw-setup-section">';
    html += '<h3 class="bpw-setup-section-title">' + _icon('bullseye') + ' Profile depth &amp; type</h3>';

    html += '<div class="bpw-setup-field">';
    html += '<label>Growth phase</label>';
    html += '<div class="bpw-setup-radio-group">';
    [
      ['new', 'New', 'Just starting — basics first'],
      ['growing', 'Growing', 'Established — refine + expand'],
      ['deep', 'Deep dive', 'Full strategic profile']
    ].forEach(function(p) {
      var checked = lvl === p[0] ? ' checked' : '';
      html += '<label class="bpw-setup-radio"><input type="radio" name="bpw-growth" value="' + p[0] + '"' + checked + disabled + '><span>' + _esc(p[1]) + '<small>' + _esc(p[2]) + '</small></span></label>';
    });
    html += '</div></div>';

    html += '<div class="bpw-setup-field">';
    html += '<label>Brand types <span class="bpw-setup-field-hint">pick all that apply</span></label>';
    html += '<div class="bpw-setup-checkbox-group">';
    [['commercial', 'Commercial'], ['local', 'Local'], ['creator', 'Creator'], ['nonprofit', 'Cause']].forEach(function(t) {
      var checked = types.indexOf(t[0]) !== -1 ? ' checked' : '';
      var labelOverride = (BT[t[0]] && BT[t[0]].label) || t[1];
      html += '<label class="bpw-setup-checkbox"><input type="checkbox" data-brand-type="' + t[0] + '"' + checked + disabled + '><span>' + _esc(t[1]) + '<small>' + _esc(labelOverride) + '</small></span></label>';
    });
    html += '</div></div>';

    html += '</div>'; // /bpw-setup-section

    // ── Section: AI provider ──────────────────────────────────────────
    var configured = window.LLMService && window.LLMService.isConfigured();
    html += '<div class="bpw-setup-section">';
    html += '<h3 class="bpw-setup-section-title">' + _icon('robot') + ' AI provider</h3>';
    html += '<div class="bpw-setup-field bpw-setup-field-ai">';
    if (configured) {
      html += '<div class="bpw-setup-ai-selects">';
      html += window.LLMService.renderProviderSelect();
      html += window.LLMService.renderModelSelect();
      html += '</div>';
    } else {
      html += '<div class="bpw-setup-warn">' + _icon('triangle-exclamation') + ' No AI providers configured — add credentials in Drupal AI settings.</div>';
    }
    html += '</div></div>';

    if (!running) {
      var disabledStart = configured ? '' : ' disabled';
      html += '<div class="bpw-setup-actions">';
      html += '<button class="bpw-setup-start" data-action="bpw-setup-start" type="button"' + disabledStart + '>' + _icon('play') + ' Start autopilot</button>';
      html += '<p class="bpw-setup-actions-hint">We\'ll pause after the first step so you can confirm we understood your brand correctly.</p>';
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

    var awaitingReview = W.setup && W.setup.awaitingReview === stage.id;
    var classes = 'bpw-setup-stage bpw-setup-stage--' + status.state + (awaitingReview ? ' bpw-setup-stage--review' : '');

    var html = '<article class="' + classes + '" data-stage-id="' + _esc(stage.id) + '">';
    html += '<div class="bpw-setup-stage-head">';
    html += '<span class="bpw-setup-stage-icon">' + _icon(iconMap[status.state] || 'circle') + '</span>';
    html += '<div class="bpw-setup-stage-titles">';
    html += '<div class="bpw-setup-stage-label">' + _esc(stage.label) + (awaitingReview ? ' <span class="bpw-setup-stage-badge">Awaiting your review</span>' : '') + '</div>';
    html += '<div class="bpw-setup-stage-status">' + _esc(awaitingReview ? 'paused — confirm or refine' : status.state) + elapsed + '</div>';
    html += '</div>';
    if ((status.state === 'done' || status.state === 'failed') && !awaitingReview) {
      html += '<button class="bpw-setup-stage-expand" data-action="bpw-setup-expand" data-stage-id="' + _esc(stage.id) + '" type="button" aria-expanded="false">' + _icon('chevron-down') + ' Details</button>';
    }
    html += '</div>';
    if (summary) html += '<div class="bpw-setup-stage-summary">' + _esc(summary) + '</div>';

    if (awaitingReview) {
      html += _renderReviewPanel(stage);
    }

    if (status.state === 'failed' && status.error) {
      html += '<div class="bpw-setup-stage-error">' + _icon('triangle-exclamation') + ' ' + _esc(status.error) + '</div>';
      html += '<div class="bpw-setup-stage-actions">';
      html += '<button class="bpw-setup-stage-recover" data-action="bpw-setup-recover" data-stage-id="' + _esc(stage.id) + '" type="button">' + _icon('rotate-right') + ' Recover</button>';
      html += '<button class="bpw-setup-stage-skip" data-action="bpw-setup-skip" data-stage-id="' + _esc(stage.id) + '" type="button">Skip</button>';
      html += '</div>';
    }
    html += '<div class="bpw-setup-stage-expansion"' + (awaitingReview ? '' : ' hidden') + '>';
    if (awaitingReview) {
      try { html += (stage.expandRenderer && stage.expandRenderer(W)) || ''; } catch (e) {}
    }
    html += '</div>';
    html += '</article>';
    return html;
  }

  function _renderReviewPanel(stage) {
    var html = '<div class="bpw-setup-review">';
    html += '<div class="bpw-setup-review-prompt">' + _icon('clipboard-check') + ' <strong>Does this look like your actual brand?</strong> If anything is generic or wrong, add detail in the form on the left and re-run — every later step builds on this.</div>';
    html += '<div class="bpw-setup-review-actions">';
    html += '<button class="bpw-setup-review-continue" data-action="bpw-setup-continue-review" type="button">' + _icon('circle-check') + ' Looks right — continue</button>';
    html += '<button class="bpw-setup-review-rerun" data-action="bpw-setup-rerun-stage" data-stage-id="' + _esc(stage.id) + '" type="button">' + _icon('rotate-right') + ' Re-run with my edits</button>';
    html += '<button class="bpw-setup-review-skip" data-action="bpw-setup-skip-review" data-stage-id="' + _esc(stage.id) + '" type="button">' + _icon('forward') + ' Skip — use my notes only</button>';
    html += '</div></div>';
    return html;
  }

  // ── EVENTS ──────────────────────────────────────────────────────────
  function _wireEvents() {
    var ns = '.bpw-setup';

    $(document).off('input' + ns, '.bpw-setup [data-field]')
      .on('input' + ns, '.bpw-setup [data-field]', function() {
        var field = $(this).data('field');
        W.seedContext = W.seedContext || {};
        if (field === 'url')                W.seedContext.url                = $(this).val();
        if (field === 'name')               W.seedContext.name               = $(this).val();
        if (field === 'description')        W.seedContext.description        = $(this).val();
        if (field === 'customInstructions') W.seedContext.customInstructions = $(this).val();
        // Don't mirror into W.acceptedSections — that would trip
        // openIfFirstRun()'s "existing profile" guard on reload.
        // BrandService.getIdentity() falls back to seedContext.name
        // when acceptedSections.identity is empty.
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
        var toast = window._bpwToast || function(msg) { alert(msg); };
        if (!(W.brandTypes && W.brandTypes.length)) {
          toast('Pick at least one brand type.', 'warning');
          return;
        }
        if (!(W.seedContext && (W.seedContext.url || W.seedContext.name))) {
          toast('Provide a website URL or a brand name.', 'warning');
          return;
        }
        if (!window.LLMService || !window.LLMService.isConfigured()) {
          toast('No AI provider configured. Add credentials in Drupal AI settings.', 'error');
          return;
        }
        var queue = window._bpwSetupStages.stagesFor(W.brandLevel || 'new', W.brandTypes || []);
        if (!queue.length) {
          toast('No stages apply to this growth phase + types combination.', 'warning');
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

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-exit"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-exit"]', function(e) {
        e.preventDefault();
        // Native confirm is intentional here: an irreversible exit
        // deserves a hard stop. Stages already completed persist.
        if (!window.confirm('Exit the autopilot? Stages already completed are kept. You can re-open from Settings.')) return;
        // Auto-accept whatever is already generated so the user keeps
        // partial progress, then bail out cleanly.
        if (W.setup) {
          // Mark setup finished so the shell renders on next mount.
          W.setup.finishedAt = Date.now();
          W.setup.open = false;
        }
        W.isAIProcessing = false;
        // Auto-accept whatever flat keys are in W.generatedSections.
        var accept = window._bpwAcceptSection;
        var gen = W.generatedSections || {};
        if (accept) {
          for (var k in gen) {
            if (!gen.hasOwnProperty(k)) continue;
            var st = (W.sectionStates || {})[k];
            if (st === 'accepted') continue;
            try { accept(k, gen[k]); } catch (err) { console.warn(LOG, 'auto-accept on exit failed for', k, err); }
          }
        }
        if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
        if (window._bpwAutoSave) window._bpwAutoSave();
        close();
        if (window._bpwAppShell && window._bpwAppShell.render) {
          window._bpwAppShell.render();
        } else if (window._bpwRender) {
          window._bpwRender();
        }
        if (window._bpwToast) window._bpwToast('Autopilot closed — partial progress saved.', 'info');
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

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-continue-review"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-continue-review"]', function(e) {
        e.preventDefault();
        var orch = window._bpwSetupOrchestrator;
        if (!orch || !orch.continueReview) return;
        orch.continueReview();
        _render();
      });

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-rerun-stage"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-rerun-stage"]', function(e) {
        e.preventDefault();
        var orch = window._bpwSetupOrchestrator;
        if (!orch || !orch.rerunStage) return;
        var stageId = $(this).data('stage-id');
        // Need at least a URL or some context to re-run scrape.
        if (stageId === 'scrape') {
          var seed = W.seedContext || {};
          if (!(seed.url || seed.description || seed.customInstructions)) {
            if (window._bpwToast) window._bpwToast('Add a URL, description, or custom instructions before re-running.', 'warning');
            return;
          }
        }
        orch.rerunStage(stageId);
        _render();
      });

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-skip-review"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-skip-review"]', function(e) {
        e.preventDefault();
        var orch = window._bpwSetupOrchestrator;
        if (!orch) return;
        // Mark current review-gated stage as skipped and move on.
        orch.skipCurrent();
        _render();
      });

    $(document).off('input' + ns + ' change' + ns, '.bpw-setup [data-social-field]')
      .on('input' + ns + ' change' + ns, '.bpw-setup [data-social-field]', function() {
        var $row = $(this).closest('.bpw-setup-socials-row');
        var idx = parseInt($row.attr('data-social-idx'), 10);
        if (isNaN(idx)) return;
        W.importedAssets = W.importedAssets || {};
        W.importedAssets.website = W.importedAssets.website || {};
        W.importedAssets.website.extracted = W.importedAssets.website.extracted || {};
        var arr = W.importedAssets.website.extracted.social_profiles = W.importedAssets.website.extracted.social_profiles || [];
        arr[idx] = arr[idx] || {};
        arr[idx][$(this).data('social-field')] = $(this).val();
        if (window._bpwAutoSave) window._bpwAutoSave();
      });

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-social-add"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-social-add"]', function(e) {
        e.preventDefault();
        W.importedAssets = W.importedAssets || {};
        W.importedAssets.website = W.importedAssets.website || {};
        W.importedAssets.website.extracted = W.importedAssets.website.extracted || {};
        var arr = W.importedAssets.website.extracted.social_profiles = W.importedAssets.website.extracted.social_profiles || [];
        arr.push({ platform: 'other', handle: '', url: '' });
        if (window._bpwAutoSave) window._bpwAutoSave();
        _render();
      });

    $(document).off('click' + ns, '.bpw-setup [data-action="bpw-setup-social-remove"]')
      .on('click' + ns, '.bpw-setup [data-action="bpw-setup-social-remove"]', function(e) {
        e.preventDefault();
        var $row = $(this).closest('.bpw-setup-socials-row');
        var idx = parseInt($row.attr('data-social-idx'), 10);
        if (isNaN(idx)) return;
        var ex = ((W.importedAssets || {}).website || {}).extracted || {};
        if (!Array.isArray(ex.social_profiles)) return;
        ex.social_profiles.splice(idx, 1);
        if (window._bpwAutoSave) window._bpwAutoSave();
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
          // Prefer the new three-pane app shell once it's loaded.
          // Fall back to legacy render only if the shell isn't there.
          if (window._bpwAppShell && window._bpwAppShell.render) {
            window._bpwAppShell.render();
          } else if (window._bpwRender) {
            window._bpwRender();
          }
          if (window._bpwToast) {
            var msg = (mode === 'delta')
              ? 'New stages complete — back to the brand profile.'
              : 'Autopilot complete — review your brand profile.';
            window._bpwToast(msg, 'success');
          }
        }, 800);
      }
    });
  }

  window._bpwSetup = {
    openIfFirstRun: openIfFirstRun,
    openDelta: openDelta,
    forceOpen: forceOpen,
    close: close,
    render: _render
  };
})();
