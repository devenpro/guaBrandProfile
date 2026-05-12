/**
 * Brand Profile Wizard v1.0 — bpw-part2b.js
 *
 * Assembly & intelligence layer: transforms flat AI outputs
 * into proper v2 schema modules, generates AI discovery questions,
 * collects form data, auto-triggers AI, and provides session
 * protection and keyboard shortcuts.
 *
 * Polls for Part 1 + Part 2A initialization.
 *
 * Sections:
 *  1. Init & Imports
 *  2. Section Assembly Engine
 *  3. AI Discovery Question Generator
 *  4. Basics Form Collector
 *  5. Auto-Trigger AI on Step Entry
 *  6. Navigation Guards (collect before leave)
 *  7. Enhanced Completeness Engine
 *  8. Session Protection & Keyboard Shortcuts
 *  9. Enhanced Toast (with icons)
 * 10. Post-Wizard Actions
 * 11. Event Wiring & Overrides
 * 12. Exports
 *
 * @version 1.0.0
 */
(function($, Drupal) {
  'use strict';

  // ============================================================
  // SECTION 1: INIT & IMPORTS
  // ============================================================

  var W, LLMService, render, goStep, toast, autoSave, syncToTextarea;
  var esc, icon, generateId, deepClone, has, isLevel, isLevelOrAbove, typeLabels;
  var buildAIContext, getLangInstruction, parseAIResponse;
  var setSectionState, acceptSection, buildFinalProfile;
  var Part2A;

  var LOG = '[BPW-2B]';
  var _pollCount = 0;
  var _pollTimer = setInterval(function() {
    _pollCount++;

    if (window._bpwState && window._bpwState.initialized && window._bpwPart2A && window._bpwPart2A.initialized) {
      clearInterval(_pollTimer);
      initPart2B();
      return;
    }

    if (_pollCount % 50 === 0) {
      console.log(LOG, 'Waiting...', {
        Part1: window._bpwState ? (window._bpwState.initialized ? 'ready' : 'loaded but not init') : 'missing',
        Part2A: window._bpwPart2A ? (window._bpwPart2A.initialized ? 'ready' : 'loaded but not init') : 'missing',
        pollCount: _pollCount
      });
    }

    if (_pollCount > 350) {
      clearInterval(_pollTimer);
      var p1 = window._bpwState ? (window._bpwState.initialized ? 'ready' : 'not initialized') : 'not loaded';
      var p2a = window._bpwPart2A ? (window._bpwPart2A.initialized ? 'ready' : 'not initialized') : 'not loaded';
      console.warn(LOG, 'Timed out. Part 1:', p1, '| Part 2A:', p2a,
        '— The wizard may not be needed on this page.');
    }
  }, 100);

  function initPart2B() {
    console.log(LOG, 'Initializing...');

    W = window._bpwState;
    LLMService = window._bpwLLMService;
    render = window._bpwRender;
    goStep = window._bpwGoStep;
    toast = window._bpwToast;
    autoSave = window._bpwAutoSave;
    syncToTextarea = window._bpwSyncToTextarea;
    buildFinalProfile = window._bpwBuildFinalProfile;
    esc = window._bpwEsc;
    icon = window._bpwIcon;
    generateId = window._bpwGenerateId;
    deepClone = window._bpwDeepClone;
    has = window._bpwHas;
    isLevel = window._bpwIsLevel;
    isLevelOrAbove = window._bpwIsLevelOrAbove;
    typeLabels = window._bpwTypeLabels;
    buildAIContext = window._bpwBuildAIContext;
    getLangInstruction = window._bpwGetLangInstruction;
    parseAIResponse = window._bpwParseAIResponse;
    setSectionState = window._bpwSetSectionState;
    acceptSection = window._bpwAcceptSection;
    Part2A = window._bpwPart2A;

    // Override Part 1's navigation hooks
    installNavigationGuards();
    installSessionProtection();
    installKeyboardShortcuts();
    overrideAcceptSection();

    // S2 FIX: Wire events immediately from initPart2B, not from standalone timer
    setupPart2BEvents();

    console.log(LOG, 'Initialized. Assembly engine active.');
  }

  // ============================================================
  // SECTION 2: SECTION ASSEMBLY ENGINE
  // ============================================================
  //
  // Part 2A stores AI outputs as flat keys in W.generatedSections:
  //   market_category, market_positioning, market_competitors, ...
  //   voice_tone, voice_personality, voice_dos, ...
  //
  // The v2 schema expects nested modules:
  //   market: { category, positioning, competitors[], ... }
  //   voice: { primary_tone, personality_traits[], dos[], ... }
  //
  // This engine assembles flat keys into proper modules when
  // sections are accepted, so W.acceptedSections contains
  // well-structured data ready for the final profile.

  var ASSEMBLY_MAP = {
    // key pattern → { module, field }
    // Identity
    identity_mission:         { module: 'identity', field: 'mission' },
    identity_mission_options: { module: '_internal', field: 'mission_options' },
    identity_vision:          { module: 'identity', field: 'vision' },
    identity_values:          { module: 'identity', field: 'values' },
    identity_archetype:       { module: 'identity', field: 'brand_archetype' },
    identity_pitch:           { module: 'identity', field: 'elevator_pitch' },

    // Voice
    voice_tone:           { module: 'voice', field: 'primary_tone' },
    voice_personality:    { module: 'voice', field: 'personality_traits' },
    voice_dos:            { module: 'voice', field: 'dos' },
    voice_donts:          { module: 'voice', field: 'donts' },
    voice_preferred:      { module: 'voice', field: 'vocabulary.preferred_terms' },
    voice_avoided:        { module: 'voice', field: 'vocabulary.avoided_terms' },
    voice_sample:         { module: 'voice', field: 'sample_texts' },

    // Messaging
    messaging_primary:    { module: 'messaging', field: 'primary_message' },
    messaging_supporting: { module: 'messaging', field: 'supporting_messages' },
    messaging_headlines:  { module: 'messaging', field: 'headlines' },

    // Audience
    audience_primary:   { module: 'audience', field: 'primary_description' },
    audience_segments:  { module: 'audience', field: 'segments' },
    audience_personas:  { module: 'audience', field: 'personas' },

    // Market
    market_category:        { module: 'market', field: 'category' },
    market_positioning:     { module: 'market', field: 'positioning' },
    market_competitors:     { module: 'market', field: 'competitors' },
    market_differentiators: { module: 'market', field: 'differentiators' },
    market_trends:          { module: 'market', field: 'trends' },
    market_opportunities:   { module: 'market', field: 'opportunities' },

    // Offerings
    offerings_items:    { module: 'offerings', field: 'items' },
    offerings_content:  { module: 'offerings', field: '_content_desc' },
    offerings_revenue:  { module: 'offerings', field: 'monetization.revenue_streams' },
    offerings_pricing:  { module: 'offerings', field: 'pricing_model' },
    offerings_programs: { module: 'offerings', field: 'items' },

    // Content Strategy
    content_pillars:  { module: 'content_strategy', field: 'pillars' },
    content_channels: { module: 'content_strategy', field: 'channels' },
    content_seo:      { module: 'content_strategy', field: 'seo_keywords' },
    content_hashtags: { module: 'content_strategy', field: 'hashtags' }
  };

  function assembleModule(sectionKey, data) {
    var mapping = ASSEMBLY_MAP[sectionKey];
    if (!mapping || mapping.module === '_internal') return;

    var mod = mapping.module;
    var field = mapping.field;

    // Initialize module if not exists
    W.acceptedSections[mod] = W.acceptedSections[mod] || {};

    // Handle nested fields (e.g., 'vocabulary.preferred_terms')
    if (field.indexOf('.') !== -1) {
      var parts = field.split('.');
      var target = W.acceptedSections[mod];
      for (var i = 0; i < parts.length - 1; i++) {
        target[parts[i]] = target[parts[i]] || {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = data;
    } else {
      W.acceptedSections[mod][field] = data;
    }
  }

  function overrideAcceptSection() {
    // Fix 2: Set on a NEW property that Part 1's local acceptSection() checks
    window._bpwAcceptSectionOverride = function(key, data) {
      // 1. Assembly: merge into proper nested module (voice_tone → voice.primary_tone)
      assembleModule(key, data);

      // 2. Preserve flat key for AI section display and resume
      W.acceptedSections[key] = data;

      // 3. Keep in generatedSections for re-render
      W.generatedSections[key] = data;

      // 4. Mark state
      W.sectionStates[key] = 'accepted';
      W.dirty = true;

      // 5. Phase tracking: update audience phase when audience sections accepted
      if (key === 'audience_primary' || key === 'audience_segments') {
        if (W._audiencePhase === 'audience_generated' || W._audiencePhase === 'initial') {
          // Check if both key audience sections are now accepted or at least one is
          var ap = W.sectionStates.audience_primary === 'accepted';
          var as = W.sectionStates.audience_segments === 'accepted';
          if (ap || as) {
            W._audiencePhase = 'audience_accepted';
            console.log(LOG, 'Audience phase → audience_accepted');
          }
        }
      }

      // 6. Auto-save
      if (autoSave) autoSave();
    };

    // Also update Part 2A's local reference
    if (Part2A) {
      acceptSection = function(key, data) {
        window._bpwAcceptSectionOverride(key, data);
      };
    }

    console.log(LOG, 'Accept section override installed');
  }

  function assembleIdentityFromSeed() {
    var sc = W.seedContext || {};
    var id = W.acceptedSections.identity || {};

    id.name = sc.name || id.name || '';
    id.description = sc.description || id.description || '';
    id.website_url = sc.website_url || id.website_url || '';

    // Type-specific fields
    if (has('commercial') || has('local')) {
      id.industry = sc.industry || id.industry || '';
      id.business_model = sc.business_model || id.business_model || '';
    }
    if (has('local')) {
      id.service_area = sc.service_area || id.service_area || '';
      id.service_category = sc.service_category || id.service_category || '';
    }
    if (has('creator')) {
      id.primary_platform = sc.primary_platform || id.primary_platform || '';
      id.content_niche = sc.content_niche || id.content_niche || '';
    }
    if (has('nonprofit')) {
      id.cause_area = sc.cause_area || id.cause_area || '';
      id.organization_type = sc.organization_type || id.organization_type || '';
    }

    // Social profiles from channel URL
    if (sc.channel_url) {
      id.social_profiles = id.social_profiles || [];
      var hasChannel = false;
      for (var i = 0; i < id.social_profiles.length; i++) {
        if (id.social_profiles[i].url === sc.channel_url) { hasChannel = true; break; }
      }
      if (!hasChannel) {
        id.social_profiles.push({ id: generateId('sp'), platform: sc.primary_platform || 'other', url: sc.channel_url, handle: '' });
      }
    }

    W.acceptedSections.identity = id;
  }

  function assembleOfferingsType() {
    var off = W.acceptedSections.offerings || {};
    if (has('creator')) off.type = 'content';
    else if (has('nonprofit')) off.type = 'programs';
    else if (has('local')) off.type = 'services';
    else off.type = 'products';
    off.summary = off.summary || '';
    W.acceptedSections.offerings = off;
  }

  // ============================================================
  // SECTION 3: AI DISCOVERY QUESTION GENERATOR
  // ============================================================

  function generateAIDiscoveryQuestions(callback) {
    if (!LLMService || !LLMService.isConfigured()) {
      console.log(LOG, 'No AI configured, using hardcoded questions');
      if (callback) callback(null);
      return;
    }

    var ctx = buildAIContext();
    var qCount = isLevel('deep') ? '8-10' : isLevel('growing') ? '5-7' : '3-5';
    var lang = getLangInstruction();

    var systemPrompt = 'You are a brand strategist conducting a discovery session for a ' + typeLabels() + ' brand. Generate targeted, insightful questions to understand this brand deeply. Adapt questions based on the brand type and any information already provided.' + lang;

    var userPrompt = 'Based on this brand context, generate ' + qCount + ' discovery questions.\n\n'
      + 'Brand context:\n' + JSON.stringify(ctx, null, 2) + '\n\n'
      + 'For each question, determine the best input type:\n'
      + '- "text" for open-ended answers\n'
      + '- "radio" for single-choice with 4-6 options\n\n'
      + 'Return ONLY valid JSON:\n'
      + '{\n'
      + '  "questions": [\n'
      + '    {\n'
      + '      "id": "q1",\n'
      + '      "text": "The question",\n'
      + '      "type": "text|radio",\n'
      + '      "why": "Why this matters (shown as hint)",\n'
      + '      "placeholder": "Placeholder for text type",\n'
      + '      "options": ["Option A", "Option B"],\n'
      + '      "allowDetail": true\n'
      + '    }\n'
      + '  ]\n'
      + '}\n\n'
      + 'IMPORTANT: Make questions specific to ' + typeLabels() + ' brands.\n'
      + 'Do NOT ask about things already known from the context.\n'
      + 'RESPOND WITH VALID JSON ONLY.';

    console.log(LOG, 'Generating AI discovery questions...');
    W._aiDiscoveryLoading = true;
    render();

    LLMService.callAI(userPrompt, function(rawText) {
      W._aiDiscoveryLoading = false;
      var parsed = parseAIResponse(rawText);
      if (parsed.success && parsed.data && parsed.data.questions) {
        W._aiDiscoveryQuestions = parsed.data.questions;
        console.log(LOG, 'AI generated', parsed.data.questions.length, 'discovery questions');
        if (callback) callback(parsed.data.questions);
      } else {
        console.warn(LOG, 'AI discovery questions parse failed, falling back to hardcoded');
        W._aiDiscoveryQuestions = null;
        if (callback) callback(null);
      }
      render();
    }, function(err) {
      W._aiDiscoveryLoading = false;
      console.warn(LOG, 'AI discovery questions failed:', err, '— using hardcoded');
      W._aiDiscoveryQuestions = null;
      if (callback) callback(null);
      render();
    }, systemPrompt);
  }

  // ============================================================
  // SECTION 4: BASICS FORM COLLECTOR
  // ============================================================
  //
  // Collects all form fields from the Basics screen into
  // W.seedContext before navigating away.

  function collectBasicsForm() {
    var fields = {};
    $('.bpw-step-card [data-field]').each(function() {
      var $el = $(this);
      var field = $el.data('field');
      if (!field) return;
      // Skip AI setup fields
      if (field === 'ai-provider-setup' || field === 'ai-model-setup') return;
      if (field === 'ai-provider' || field === 'ai-model') return;
      fields[field] = $el.val();
    });

    // Merge into seedContext
    for (var k in fields) {
      if (fields.hasOwnProperty(k) && fields[k]) {
        W.seedContext[k] = fields[k];
      }
    }

    // Also assemble identity module from seed
    assembleIdentityFromSeed();
    console.log(LOG, 'Collected basics:', Object.keys(fields).length, 'fields');
  }

  function collectImportForm() {
    var pastedDocs = $('[data-field="pasted_documents"]').val();
    if (pastedDocs) W.importedAssets.pasted_documents = pastedDocs;

    // Collect social profile URLs that haven't been scraped yet
    var profiles = W.importedAssets.social_profiles || [];
    var rowCount = W._socialRows || 1;
    for (var i = 0; i < rowCount; i++) {
      var platform = $('[data-field="social-platform-' + i + '"]').val();
      var url = $('[data-field="social-url-' + i + '"]').val();
      if (url && url.trim()) {
        while (profiles.length <= i) profiles.push({});
        if (!profiles[i].url) {
          profiles[i].platform = platform;
          profiles[i].url = url;
        }
      }
    }
    W.importedAssets.social_profiles = profiles;
  }

  function collectDiscoveryForm() {
    // Collect text answers
    $('[data-field^="discovery-text-"]').each(function() {
      var field = $(this).data('field');
      var qid = field.replace('discovery-text-', '');
      W.discoveryAnswers[qid] = W.discoveryAnswers[qid] || {};
      W.discoveryAnswers[qid].text = $(this).val();
    });

    // Collect detail answers
    $('[data-field^="discovery-detail-"]').each(function() {
      var field = $(this).data('field');
      var qid = field.replace('discovery-detail-', '');
      W.discoveryAnswers[qid] = W.discoveryAnswers[qid] || {};
      W.discoveryAnswers[qid].detail = $(this).val();
    });
  }

  // ============================================================
  // SECTION 5: AUTO-TRIGGER REMOVED (G9)
  // AI now runs ONLY when user clicks the Generate button.
  // ============================================================

  function checkAutoTrigger(stepId) {
    // G9: Disabled — user controls when AI runs
    return;
  }

  function _getSectionKeys(stepKey) {
    var map = {
      market: ['market_category', 'market_positioning', 'market_competitors', 'market_differentiators'],
      identity: ['identity_mission', 'identity_vision', 'identity_values', 'identity_archetype', 'identity_pitch'],
      voice: ['voice_tone', 'voice_personality', 'voice_dos', 'voice_donts', 'messaging_primary'],
      audience: ['audience_primary', 'audience_segments'],
      offerings: ['offerings_items'],
      content: ['content_pillars', 'content_channels', 'content_seo']
    };
    return map[stepKey] || [];
  }

  // ============================================================
  // SECTION 6: NAVIGATION GUARDS
  // ============================================================
  //
  // Before leaving a step, collect any unsaved form data.
  // After entering a step, check for auto-trigger.

  function installNavigationGuards() {
    var originalGoNext = null;

    // Override go-next click handler to add collection
    $(document).off('click.bpw2b-next').on('click.bpw2b-next', '[data-action="go-next"]', function(e) {
      // Collect data from current step BEFORE Part 1's handler runs
      collectCurrentStepData();
    });

    // Override go-prev to also collect
    $(document).off('click.bpw2b-prev').on('click.bpw2b-prev', '[data-action="go-prev"]', function(e) {
      collectCurrentStepData();
    });

    // Watch for step changes to auto-trigger
    var _lastStepId = W.currentStepId;
    var _stepWatcher = setInterval(function() {
      if (W.currentStepId !== _lastStepId) {
        var newStep = W.currentStepId;
        _lastStepId = newStep;
        onStepEntered(newStep);
      }
    }, 200);
  }

  function collectCurrentStepData() {
    var step = W.currentStepId;
    switch (step) {
      case 'basics':
        collectBasicsForm();
        break;
      case 'import':
        collectImportForm();
        break;
      case 'discovery':
        collectDiscoveryForm();
        break;
    }
  }

  function onStepEntered(stepId) {
    console.log(LOG, 'Entered step:', stepId);

    // Auto-trigger AI for generation steps
    checkAutoTrigger(stepId);

    // Generate AI discovery questions when entering discovery step
    if (stepId === 'discovery' && !W._aiDiscoveryQuestions && !W._aiDiscoveryLoading) {
      generateAIDiscoveryQuestions(function(questions) {
        // Questions will be used on next render
        if (questions) render();
      });
    }
  }

  // ============================================================
  // SECTION 7: ENHANCED COMPLETENESS ENGINE
  // ============================================================

  function calculateDetailedCompleteness() {
    var modules = {};
    var acc = W.acceptedSections || {};

    // Identity
    modules.identity = _moduleScore(acc.identity, [
      'name', 'description', 'mission', 'vision', 'values',
      'brand_archetype', 'elevator_pitch'
    ]);

    // Voice
    modules.voice = _moduleScore(acc.voice, [
      'primary_tone', 'personality_traits', 'dos', 'donts'
    ]);

    // Messaging
    modules.messaging = _moduleScore(acc.messaging, [
      'primary_message', 'supporting_messages', 'headlines'
    ]);

    // Audience
    modules.audience = _moduleScore(acc.audience, [
      'primary_description', 'segments'
    ]);
    if (isLevelOrAbove('growing')) {
      modules.audience = _moduleScore(acc.audience, [
        'primary_description', 'segments', 'personas'
      ]);
    }

    // Offerings
    modules.offerings = _moduleScore(acc.offerings, ['items', 'type']);

    // Market (conditional)
    if (isLevelOrAbove('growing') && (has('commercial') || has('local'))) {
      modules.market = _moduleScore(acc.market, [
        'category', 'positioning', 'competitors', 'differentiators'
      ]);
    }

    // Content (conditional)
    if (has('creator') || (isLevel('deep') && has('commercial'))) {
      modules.content_strategy = _moduleScore(acc.content_strategy, [
        'pillars', 'channels', 'seo_keywords'
      ]);
    }

    // Overall
    var total = 0, sum = 0, count = 0;
    for (var m in modules) {
      if (modules.hasOwnProperty(m)) {
        sum += modules[m];
        count++;
      }
    }
    total = count > 0 ? Math.round(sum / count) : 0;

    return { overall: total, modules: modules };
  }

  function _moduleScore(obj, fields) {
    if (!obj || typeof obj !== 'object') return 0;
    var filled = 0;
    for (var i = 0; i < fields.length; i++) {
      var val = obj[fields[i]];
      if (val !== undefined && val !== null && val !== '') {
        if (Array.isArray(val) && val.length === 0) continue;
        if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) continue;
        filled++;
      }
    }
    return fields.length > 0 ? Math.round((filled / fields.length) * 100) : 0;
  }

  // ============================================================
  // SECTION 8: SESSION PROTECTION & KEYBOARD SHORTCUTS
  // ============================================================

  function installSessionProtection() {
    $(window).on('beforeunload.bpw', function(e) {
      if (W.dirty) {
        // Force a save before leaving
        syncToTextarea();
        var msg = 'Your brand profile has unsaved changes. Are you sure you want to leave?';
        e.returnValue = msg;
        return msg;
      }
    });
  }

  function installKeyboardShortcuts() {
    $(document).off('keydown.bpw-shortcuts').on('keydown.bpw-shortcuts', function(e) {
      // Ctrl+S / Cmd+S — Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        collectCurrentStepData();
        syncToTextarea();
        toast('Progress saved', 'success');
      }

      // Escape — Cancel editing
      if (e.key === 'Escape') {
        var $editing = $('.bpw-inline-editor');
        if ($editing.length) {
          var key = $editing.find('.bpw-edit-area').data('edit-key');
          if (key) {
            setSectionState(key, W.generatedSections[key] ? 'generated' : 'pending');
            render();
          }
        }
        var $redo = $('.bpw-redo-dialog');
        if ($redo.length) {
          var redoKey = $redo.find('.bpw-redo-input').data('redo-key');
          if (redoKey) {
            setSectionState(redoKey, W.generatedSections[redoKey] ? 'generated' : 'pending');
            render();
          }
        }
      }

      // Ctrl+Enter — Next step
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        $('[data-action="go-next"]').first().trigger('click');
      }
    });
  }

  // ============================================================
  // SECTION 9: ENHANCED TOAST
  // ============================================================

  // Override Part 1's toast with icon-enhanced version
  function enhancedToast(msg, type) {
    type = type || 'info';
    var icons = {
      success: 'check-circle',
      error: 'circle-exclamation',
      warning: 'triangle-exclamation',
      info: 'circle-info'
    };
    var ic = icons[type] || 'circle-info';
    var $t = $('<div class="bpw-toast bpw-toast-' + type + '"><span class="bpw-toast-icon">' + icon(ic) + '</span> ' + esc(msg) + '</div>');
    $('body').append($t);
    setTimeout(function() { $t.addClass('bpw-toast-show'); }, 10);
    setTimeout(function() {
      $t.removeClass('bpw-toast-show');
      setTimeout(function() { $t.remove(); }, 300);
    }, 3000);
  }

  // ============================================================
  // SECTION 10: POST-WIZARD ACTIONS
  // ============================================================

  function completeWizard() {
    // Final collection from current form
    collectCurrentStepData();

    // Ensure identity is assembled from seed
    assembleIdentityFromSeed();
    assembleOfferingsType();

    // buildFinalProfile() now handles: seed merge, _wizard_state, status=complete
    var profile = buildFinalProfile();
    profile.meta.wizard_status = 'complete';

    // Write to textarea and trigger Drupal save
    W.$textarea.val(JSON.stringify(profile));
    if (W.$submitBtn && W.$submitBtn.length) {
      W.$submitBtn.click();
      enhancedToast('Brand profile saved! Page will reload.', 'success');
    } else {
      enhancedToast('Profile saved to data field. Click the Drupal Save button to persist.', 'info');
    }
  }

  function exportJSON() {
    collectCurrentStepData();
    assembleIdentityFromSeed();
    assembleOfferingsType();

    var profile = buildFinalProfile();

    var brandName = (W.seedContext.name || 'brand-profile').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = brandName + '-profile.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    enhancedToast('JSON exported: ' + brandName + '-profile.json', 'success');
  }

  // ============================================================
  // SECTION 11: EVENT WIRING & OVERRIDES
  // ============================================================

  function setupPart2BEvents() {
    // Override complete wizard
    $(document).off('click.bpw2b-complete').on('click.bpw2b-complete', '[data-action="complete-wizard"]', function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      completeWizard();
    });

    // Override export JSON
    $(document).off('click.bpw2b-export').on('click.bpw2b-export', '[data-action="export-json"]', function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      exportJSON();
    });

    // Override toast globally
    window._bpwToast = enhancedToast;

    // Add competitor from market step
    $(document).off('click.bpw2b-add-comp').on('click.bpw2b-add-comp', '[data-action="add-comp"]', function(e) {
      e.preventDefault();
      W.seedContext._knownCompetitors = W.seedContext._knownCompetitors || [];
      W.seedContext._knownCompetitors.push('');
      render();
    });

    $(document).off('click.bpw2b-rm-comp').on('click.bpw2b-rm-comp', '[data-action="remove-comp"]', function(e) {
      e.preventDefault();
      var idx = parseInt($(this).data('index'), 10);
      if (W.seedContext._knownCompetitors && W.seedContext._knownCompetitors[idx] !== undefined) {
        W.seedContext._knownCompetitors.splice(idx, 1);
        render();
      }
    });

    // Competitor input blur → save
    $(document).off('blur.bpw2b-comp').on('blur.bpw2b-comp', '[data-field^="known-comp-"]', function() {
      var idx = parseInt($(this).data('field').replace('known-comp-', ''), 10);
      W.seedContext._knownCompetitors = W.seedContext._knownCompetitors || [];
      W.seedContext._knownCompetitors[idx] = $(this).val();
    });

    // Research focus input
    $(document).off('blur.bpw2b-focus').on('blur.bpw2b-focus', '[data-field="research_focus"]', function() {
      W.seedContext._researchFocus = $(this).val();
    });
  }

  // ============================================================
  // SECTION 12: EXPORTS
  // ============================================================

  window._bpwPart2B = {
    initialized: true,
    assembleModule: assembleModule,
    assembleIdentityFromSeed: assembleIdentityFromSeed,
    assembleOfferingsType: assembleOfferingsType,
    generateAIDiscoveryQuestions: generateAIDiscoveryQuestions,
    collectBasicsForm: collectBasicsForm,
    collectImportForm: collectImportForm,
    collectDiscoveryForm: collectDiscoveryForm,
    collectCurrentStepData: collectCurrentStepData,
    calculateDetailedCompleteness: calculateDetailedCompleteness,
    completeWizard: completeWizard,
    exportJSON: exportJSON,
    enhancedToast: enhancedToast,
    ASSEMBLY_MAP: ASSEMBLY_MAP
  };

  console.log(LOG, 'Part 2B loaded');

})(jQuery, Drupal);
