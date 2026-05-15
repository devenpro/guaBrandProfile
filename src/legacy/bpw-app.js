/**
 * Brand Profile Wizard v1.0 — bpw-app.js
 *
 * Guided brand profile creation wizard with AI co-creation.
 * Runs on Drupal 11 node edit pages for brand_profile content type.
 * Activates when JSON is empty or wizard_status !== 'complete'.
 *
 * Sections:
 *  1. Constants
 *  2. State Object (W)
 *  3. Initialization
 *  4. Utilities
 *  5. Default Data & Modules
 *  6. Type Detection
 *  7. Step Builder
 *  8. Navigation
 *  9. App Shell (header, progress, step frame)
 * 10. Auto-Save & Resume
 * 11. Screen: Welcome
 * 12. Screen: Brand Type Detection
 * 13. Screen: Brand Basics
 * 14. Screen: Assets Import
 * 15. Screen: AI Discovery
 * 16. Screen: Market Research
 * 17. Screen: Identity (+ merged voice)
 * 18. Screen: Voice & Messaging
 * 19. Screen: Audience (+ merged offerings)
 * 20. Screen: Offerings
 * 21. Screen: Content & Channels
 * 22. Screen: Review & Complete
 * 23. LLMService
 * 24. AI Pipeline (prompts, parsing, section states)
 * 25. Event Handlers & Exports
 *
 * @version 1.0.0
 */
import { esc, generateId, now, formatRelativeTime, deepClone, truncate, isEmpty, debounce, estimateTokens } from '../utils/helpers.js';
import { icon } from '../utils/dom.js';
import {
  SCHEMA_VERSION, APP_ID, LOG_PREFIX,
  BRAND_TYPES, BRAND_SUBTYPES,
  DETECTION_DOES, DETECTION_WHERE, DETECTION_REVENUE,
  LANGUAGES, LANG_NAMES, SOCIAL_PLATFORMS, BRAND_ARCHETYPES,
  SECTION_STATES, LEVEL_ORDER, AI_ENDPOINTS, PROVIDER_ICONS
} from '../core/constants.js';
import { getDefaultData } from '../core/schema.js';
import { W } from '../core/state.js';

(function($, Drupal) {
  'use strict';

  // ============================================================
  // PRE-EMPTIVE: Block old editor (bp-part1.js) from v2 schema data
  // Must run BEFORE old editor's Drupal.behaviors fires.
  // ============================================================
  (function blockOldEditor() {
    // If old editor hasn't loaded yet, watch for it
    // If it already loaded, check if we need to take over
    var origBP = Drupal.behaviors && Drupal.behaviors.bpPart1;
    if (origBP) {
      var origAttach = origBP.attach;
      Drupal.behaviors.bpPart1.attach = function(context) {
        // Only let old editor run if data is v1 schema (wizard_status = complete AND no schema_version 2.0)
        var $ta = $('#edit-field-json-data-0-value');
        if ($ta.length) {
          var raw = $ta.val();
          if (raw && raw.trim()) {
            try {
              var d = JSON.parse(raw);
              if (d.meta && d.meta.schema_version === '2.0') {
                console.log('[BPW] Blocked old editor — v2 schema detected');
                return; // Don't let old editor touch v2 data
              }
            } catch(e) {}
          } else {
            // Empty textarea — wizard should handle it
            console.log('[BPW] Blocked old editor — empty textarea, wizard will handle');
            return;
          }
        }
        // v1 data or no textarea — let old editor proceed
        if (origAttach) origAttach.call(this, context);
      };
    }
  })();

  // SECTION 1: CONSTANTS — moved to ../core/constants.js
  // (imported at the top of this file)

  // SECTION 2: STATE OBJECT — moved to ../core/state.js
  // (W is imported at the top of this file).

  // ============================================================
  // SECTION 3: INITIALIZATION
  // ============================================================

  // Main attach function — standalone, not dependent on Drupal.behaviors timing
  function bpwAttach() {
    if (W.initialized || W._initializing) return;

    var bodyClass = ($('body').attr('class') || '');
    var isBP = bodyClass.indexOf('brand-profile') !== -1 || bodyClass.indexOf('brand_profile') !== -1;
    if (!isBP) {
      console.log(LOG_PREFIX, 'Not a brand_profile page.');
      return;
    }

    // Find textarea
    var $ta = null;
    var sels = [
      '#edit-field-json-data-0-value',
      'textarea[name="field_json_data[0][value]"]',
      '.field--name-field-json-data textarea',
      '#edit-field-json-data-wrapper textarea',
      'textarea[data-drupal-selector="edit-field-json-data-0-value"]'
    ];
    for (var i = 0; i < sels.length; i++) {
      $ta = $(sels[i]);
      if ($ta.length) { console.log(LOG_PREFIX, 'Found textarea via:', sels[i]); break; }
    }
    if (!$ta || !$ta.length) {
      console.log(LOG_PREFIX, 'No JSON textarea found. This is normal on VIEW pages (/node/ID). Go to /node/ID/edit to use the wizard.');
      return;
    }

    // If old editor (bp-part1.js) already initialized, clean it up
    if (window._bpState && window._bpState.initialized) {
      console.log(LOG_PREFIX, 'Old editor detected — cleaning up to take over');
      $('#bpApp').remove();
      $('body').removeClass('bp-active');
      try { window._bpState.initialized = false; } catch(e) {}
    }

    if (!shouldActivateWizard($ta)) {
      console.log(LOG_PREFIX, 'wizard_status is complete — letting editor handle.');
      return;
    }

    console.log(LOG_PREFIX, 'Activating wizard...');
    W._initializing = true;
    try { initWizard($ta); } catch (e) { console.error(LOG_PREFIX, 'initWizard failed:', e); W._initializing = false; }
  }

  // Register as Drupal behavior (handles AJAX reloads)
  Drupal.behaviors.bpw = { attach: function() { bpwAttach(); } };

  // Fallback: self-invoke since Asset Injector loads AFTER Drupal.attachBehaviors
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(bpwAttach, 50);
  } else {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(bpwAttach, 50); });
  }
  window.addEventListener('load', function() { bpwAttach(); });

  function shouldActivateWizard($ta) {
    var raw = $ta.val();
    if (!raw || !raw.trim()) {
      console.log(LOG_PREFIX, 'Textarea is empty — wizard will activate.');
      return true;
    }
    try {
      var d = JSON.parse(raw);
      var version = d.meta ? d.meta.schema_version : '';
      var status = d.meta ? d.meta.wizard_status : '';
      console.log(LOG_PREFIX, 'Existing data. schema:', version || '(none)', 'status:', status || '(none)');

      // v2 schema: ALWAYS use wizard (complete profiles load in review mode)
      if (version === '2.0') return true;

      // v1 schema or unknown: only activate if not complete (backwards compat)
      return !d.meta || status !== 'complete';
    } catch (e) {
      console.log(LOG_PREFIX, 'JSON parse failed — treating as new. Error:', e.message);
      return true;
    }
  }

  function initWizard($ta) {
    W.$textarea = $ta;
    W.$form = $ta.closest('form');
    if (!W.$form.length) {
      W.$form = $('form.node-brand-profile-form, form.node-brand-profile-edit-form, form[class*="node-form"]').first();
    }
    W.$submitBtn = W.$form.find('#edit-submit, [data-drupal-selector="edit-submit"], .form-actions input[type="submit"]').first();

    console.log(LOG_PREFIX, 'Form found:', W.$form.length > 0, 'Submit btn:', W.$submitBtn.length > 0);

    detectAndHideDrupal();
    loadData();
    LLMService.init();
    buildSteps();

    // Validate current step exists in rebuilt step list
    if (!stepById(W.currentStepId)) {
      console.warn(LOG_PREFIX, 'Saved step "' + W.currentStepId + '" not in current steps. Falling back.');
      var fallback = W.data.meta && W.data.meta.wizard_status === 'complete' ? 'review' : W.steps[W.steps.length - 1].id;
      W.currentStepId = stepById(fallback) ? fallback : W.steps[0].id;
    }

    // For completed profiles: always land on review + mark all steps as completed
    if (W.data.meta && W.data.meta.wizard_status === 'complete') {
      W.currentStepId = 'review';
      for (var si = 0; si < W.steps.length; si++) {
        if (W.steps[si].id !== 'review' && W.completedSteps.indexOf(W.steps[si].id) === -1) {
          W.completedSteps.push(W.steps[si].id);
        }
      }
      console.log(LOG_PREFIX, 'Complete profile — landing on review');
    }

    // Create app container — try multiple insertion points
    var $app = $('<div id="' + APP_ID + '"></div>');
    if (W.$form.length) {
      W.$form.before($app);
    } else {
      // Fallback: insert after main content area
      var $main = $('.layout-content, .region-content, #content, main').first();
      if ($main.length) { $main.prepend($app); }
      else { $('body').append($app); }
    }

    render();
    setupGlobalEvents();

    W.initialized = true;
    W._initializing = false;
    window._bpwState = W;
    console.log(LOG_PREFIX, 'Wizard initialized.',
      'Level:', W.brandLevel || '(not set)',
      'Types:', W.brandTypes.length ? W.brandTypes.join(', ') : '(not set)',
      'AI:', LLMService.isConfigured() ? 'configured' : 'not configured'
    );
  }

  function detectAndHideDrupal() {
    try {
      // Add body class — CSS rules handle the rest
      $('body').addClass('bpw-active');

      // Also hide specific field wrappers that CSS might miss
      W.$textarea.closest('.field--name-field-json-data, [class*="field-json-data"]').hide();

      var exportSels = ['core', 'video', 'content', 'seo', 'social'];
      for (var i = 0; i < exportSels.length; i++) {
        $('[name*="field_brand_' + exportSels[i] + '"]').closest('.form-item, .field--name-field-brand-' + exportSels[i]).hide();
      }

      console.log(LOG_PREFIX, 'Drupal chrome hidden via .bpw-active');
    } catch (e) {
      console.warn(LOG_PREFIX, 'detectAndHideDrupal partial failure:', e.message);
    }
  }

  function loadData() {
    var raw = W.$textarea.val();
    if (!raw || !raw.trim()) {
      W.data = getDefaultData();
      return;
    }
    try {
      var d = JSON.parse(raw);
      W.data = d;
      // Resume for ANY v2 schema data (in_progress OR complete)
      if (d.meta && d.meta.schema_version === '2.0') {
        resumeFromSave(d);
      }
    } catch (e) {
      console.error(LOG_PREFIX, 'JSON parse error:', e);
      W.data = getDefaultData();
    }
  }

  function resumeFromSave(d) {
    W.isResuming = true;
    var m = d.meta || {};
    W.brandLevel = m.brand_level || '';
    W.brandTypes = m.brand_types || [];
    W.brandSubtypes = m.brand_subtypes || {};
    W.language = m.language || 'en';
    W.completedSteps = (m.wizard_progress || {}).completed_steps || [];
    W.skippedSteps = (m.wizard_progress || {}).skipped_steps || [];
    W.currentStepId = (m.wizard_progress || {}).current_step || 'welcome';
    W.detection = m.detection_answers || { does: [], where: '', revenue: [] };
    W.aiProvider = m.ai_provider_used || '';
    W.aiModel = m.ai_model_used || '';

    var ws = d._wizard_state || {};
    W.seedContext = ws.seed_context || {};
    W.importedAssets = ws.imported_assets || {};
    W.discoveryAnswers = ws.discovery_answers || {};
    W.generatedSections = ws.generated_sections || {};
    W.sectionStates = ws.section_states || {};
    W.activityLog = ws.activity_log || [];

    // Restore identity phase — infer from state if not persisted
    if (ws.identity_phase) {
      W._identityPhase = ws.identity_phase;
    } else {
      // Backward compat: infer from existing data
      var ss = W.sectionStates;
      if (ss.identity_vision && ss.identity_vision === 'accepted') {
        W._identityPhase = 'full_complete';
      } else if (ss.identity_mission && ss.identity_mission === 'accepted') {
        W._identityPhase = 'mission_selected';
      } else if (W.generatedSections.identity_mission_options) {
        W._identityPhase = 'mission_options';
      } else {
        W._identityPhase = 'initial';
      }
    }

    // Restore audience phase — infer from state if not persisted
    if (ws.audience_phase) {
      W._audiencePhase = ws.audience_phase;
    } else {
      var as = W.sectionStates;
      if (as.offerings_items && as.offerings_items === 'accepted') {
        W._audiencePhase = 'offerings_generated';
      } else if (as.audience_primary && as.audience_primary === 'accepted') {
        W._audiencePhase = 'audience_accepted';
      } else if (W.generatedSections.audience_primary) {
        W._audiencePhase = 'audience_generated';
      } else {
        W._audiencePhase = 'initial';
      }
    }

    W.acceptedSections = {};
    var skipKeys = ['meta', '_wizard_state', 'ai_preferences'];
    for (var key in d) {
      if (d.hasOwnProperty(key) && skipKeys.indexOf(key) === -1 && key.charAt(0) !== '_') {
        if (d[key] && typeof d[key] === 'object' && Object.keys(d[key]).length > 0) {
          W.acceptedSections[key] = d[key];
        }
      }
    }

    // Backfill: profiles saved before the standalone social schema
    // landed live in W.importedAssets.social_profiles. Seed the new
    // schema slot once so the Social section + export pipeline find
    // them on first render.
    if (!W.acceptedSections.social || !Array.isArray(W.acceptedSections.social.profiles) || !W.acceptedSections.social.profiles.length) {
      var legacyProfiles = (W.importedAssets && W.importedAssets.social_profiles) || [];
      if (Array.isArray(legacyProfiles) && legacyProfiles.length) {
        W.acceptedSections.social = {
          profiles: legacyProfiles.map(function(sp) {
            return { platform: sp.platform || 'other', handle: sp.handle || '', url: sp.url || '' };
          })
        };
      }
    }

    console.log(LOG_PREFIX, 'Resumed from save. Step:', W.currentStepId, 'Completed:', W.completedSteps.length);
  }

  // ============================================================
  // SECTION 4: UTILITIES
  // ============================================================
  //
  // Pure helpers (esc, generateId, now, formatRelativeTime, deepClone,
  // truncate, isEmpty, debounce, estimateTokens) and `icon` are imported
  // from ../utils/ at the top of this file. The functions below depend
  // on jQuery, the W state object, or the BRAND_TYPES/LEVEL_ORDER
  // constants and will move to their owning modules in later stages.

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() { toast('Copied!', 'success'); });
    } else {
      var $tmp = $('<textarea>').val(text).appendTo('body').select();
      document.execCommand('copy');
      $tmp.remove();
      toast('Copied!', 'success');
    }
  }

  function has(type) { return W.brandTypes.indexOf(type) !== -1; }

  function isLevel(lvl) { return W.brandLevel === lvl; }

  function isLevelOrAbove(lvl) {
    return (LEVEL_ORDER[W.brandLevel] || 0) >= (LEVEL_ORDER[lvl] || 0);
  }

  function typeLabels() {
    return W.brandTypes.map(function(t) { return (BRAND_TYPES[t] || {}).label || t; }).join(' + ');
  }

  // ============================================================
  // SECTION 5: DEFAULT DATA & MODULES
  // ============================================================
  // getDefaultData moved to ../core/schema.js (imported at file top).

  function getEnabledModules() {
    var mods = ['identity', 'voice', 'messaging', 'audience', 'offerings'];
    if (isLevelOrAbove('growing') && (has('commercial') || has('local'))) mods.push('market');
    if (isLevel('deep') && has('creator')) mods.push('market');
    if (isLevelOrAbove('growing') && has('creator')) mods.push('content_strategy');
    if (isLevel('deep') && (has('commercial') || has('local'))) mods.push('content_strategy');
    if (has('commercial')) mods.push('operations');
    if (has('local')) mods.push('operations');
    if (has('nonprofit')) mods.push('operations');
    if (isLevel('deep')) mods.push('social_proof');
    return mods;
  }

  // ============================================================
  // SECTION 6: TYPE DETECTION
  // ============================================================

  function detectTypes() {
    var d = W.detection, t = [];
    var doesArr = d.does || [], where = d.where || '', rev = d.revenue || [];

    if (doesArr.indexOf('products') !== -1 || doesArr.indexOf('services') !== -1) {
      if (where === 'physical' || where === 'both') { if (t.indexOf('local') === -1) t.push('local'); }
      if (where === 'online' || where === 'both') { if (t.indexOf('commercial') === -1) t.push('commercial'); }
      if (!where) { if (t.indexOf('commercial') === -1) t.push('commercial'); }
    }
    if (doesArr.indexOf('content') !== -1) { if (t.indexOf('creator') === -1) t.push('creator'); }
    if (doesArr.indexOf('cause') !== -1) { if (t.indexOf('nonprofit') === -1) t.push('nonprofit'); }

    if (rev.indexOf('ads') !== -1 || rev.indexOf('courses') !== -1) {
      if (t.indexOf('creator') === -1) t.push('creator');
    }
    if (rev.indexOf('donations') !== -1) {
      if (t.indexOf('nonprofit') === -1) t.push('nonprofit');
    }
    if (rev.indexOf('products') !== -1 || rev.indexOf('subscriptions') !== -1 || rev.indexOf('services') !== -1) {
      if (t.indexOf('commercial') === -1 && t.indexOf('local') === -1) t.push('commercial');
    }

    if (!t.length && doesArr.length) t.push('commercial');
    return t;
  }

  function applyDetection() {
    W.brandTypes = detectTypes();
    W.data.meta = W.data.meta || {};
    W.data.meta.brand_types = W.brandTypes;
    W.data.meta.detection_answers = deepClone(W.detection);
    buildSteps();
  }

  // ============================================================
  // SECTION 7: STEP BUILDER
  // ============================================================

  function buildSteps() {
    var steps = [];
    var L = W.brandLevel;
    var isNew = L === 'new', isGrow = L === 'growing', isDeep = L === 'deep';

    steps.push({ id: 'welcome', label: 'Welcome', icon: 'wand-magic-sparkles' });
    steps.push({ id: 'detect',  label: 'Brand type', icon: 'compass' });
    steps.push({ id: 'basics',  label: 'Basics', icon: 'pen' });

    if (isGrow || isDeep) {
      steps.push({ id: 'import', label: 'Import assets', icon: 'cloud-arrow-down' });
    }

    steps.push({ id: 'discovery', label: 'Discovery', icon: 'comments' });

    if ((isGrow || isDeep) && (has('commercial') || has('local'))) {
      steps.push({ id: 'market', label: isDeep ? 'Market research' : 'Market', icon: 'chart-bar' });
    }

    if (isDeep) {
      steps.push({ id: 'identity', label: 'Identity', icon: 'fingerprint' });
      steps.push({ id: 'voice', label: 'Voice & messaging', icon: 'comment' });
      steps.push({ id: 'audience', label: 'Audience', icon: 'users' });
      if (has('commercial') || has('local') || has('nonprofit')) {
        steps.push({ id: 'offerings', label: _offeringsLabel(), icon: 'cube' });
      }
      if (has('creator') || has('commercial')) {
        steps.push({ id: 'content', label: 'Content & channels', icon: 'newspaper' });
      }
    } else if (isGrow) {
      steps.push({ id: 'identity_voice', label: 'Identity & voice', icon: 'fingerprint' });
      steps.push({ id: 'audience_offerings', label: _audienceOfferingsLabel(), icon: 'users' });
      if (has('creator')) {
        steps.push({ id: 'content', label: 'Channels', icon: 'newspaper' });
      }
    } else {
      steps.push({ id: 'identity_voice', label: 'Identity & voice', icon: 'fingerprint' });
      steps.push({ id: 'audience_offerings', label: _audienceOfferingsLabel(), icon: 'users' });
    }

    steps.push({ id: 'review', label: 'Review', icon: 'flag-checkered' });
    W.steps = steps;
    return steps;
  }

  function _offeringsLabel() {
    if (has('creator')) return 'Content & products';
    if (has('nonprofit')) return 'Programs & services';
    if (has('local')) return 'Services';
    return 'Products & services';
  }

  function _audienceOfferingsLabel() {
    if (has('creator')) return 'Audience & content';
    if (has('nonprofit')) return 'Audience & programs';
    return 'Audience & offerings';
  }

  function stepIndex() {
    for (var i = 0; i < W.steps.length; i++) {
      if (W.steps[i].id === W.currentStepId) return i;
    }
    return 0;
  }

  function stepById(id) {
    for (var i = 0; i < W.steps.length; i++) {
      if (W.steps[i].id === id) return W.steps[i];
    }
    return null;
  }

  function isStepAvailable(id) { return !!stepById(id); }

  function getStepNumber() { return stepIndex() + 1; }
  function getTotalSteps() { return W.steps.length; }

  // ============================================================
  // SECTION 8: NAVIGATION
  // ============================================================

  function goStep(stepId) {
    if (!isStepAvailable(stepId)) {
      console.warn(LOG_PREFIX, 'Step not available:', stepId);
      return;
    }
    // Save current step data before leaving
    if (W.currentStepId !== stepId) {
      autoSave();
    }
    W.currentStepId = stepId;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goNext() {
    var idx = stepIndex();
    if (idx < W.steps.length - 1) {
      _collectCurrentStepFields();
      markStepComplete(W.currentStepId);
      autoSave();
      W.currentStepId = W.steps[idx + 1].id;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goPrev() {
    var idx = stepIndex();
    if (idx > 0) {
      _collectCurrentStepFields();
      W.currentStepId = W.steps[idx - 1].id;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function skipStep() {
    var cur = W.currentStepId;
    if (W.skippedSteps.indexOf(cur) === -1) W.skippedSteps.push(cur);
    goNext();
  }

  function markStepComplete(stepId) {
    if (W.completedSteps.indexOf(stepId) === -1) W.completedSteps.push(stepId);
    var si = W.skippedSteps.indexOf(stepId);
    if (si !== -1) W.skippedSteps.splice(si, 1);
  }

  function canProceed() {
    var s = W.currentStepId;
    if (s === 'welcome') return W.brandLevel ? { ok: true } : { ok: false, msg: 'Select a brand level to continue' };
    if (s === 'detect') return W.detection.does.length ? { ok: true } : { ok: false, msg: 'Select at least one option' };
    if (s === 'basics') {
      var sc = W.seedContext;
      if (!sc.name || !sc.name.trim()) return { ok: false, msg: 'Brand name is required' };
      if (!sc.description || sc.description.trim().length < 10) return { ok: false, msg: 'Description is required (min 10 chars)' };
      return { ok: true };
    }
    return { ok: true };
  }

  // ============================================================
  // SECTION 9: APP SHELL
  // ============================================================

  // Legacy fallback render. The autopilot (src/setup/) and the
  // three-pane app shell (src/ui/) own the visible surface; this
  // function only paints when neither is active, which is rare in
  // practice (e.g. mid-boot before openIfFirstRun fires). All twelve
  // legacy step renderers were removed in the autopilot rebuild, so
  // STEP_RENDERERS is empty and we render an empty container.
  function render() {
    var $app = $('#' + APP_ID);
    if (!$app.length) return;
    var $body = $('body');
    if ($body.hasClass('bpw-setup-open') || $body.hasClass('bpw-app-shell-active')) return;
    $app.empty();
    $app.toggleClass('bpw-ai-processing', !!W.isAIProcessing);
  }


  // ============================================================
  // SECTION 10: AUTO-SAVE & RESUME
  // ============================================================

  function _mergeSeedIntoIdentity() {
    var sc = W.seedContext || {};
    if (!sc.name && !sc.description) return;
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.identity = W.acceptedSections.identity || {};
    var id = W.acceptedSections.identity;
    var fields = ['name', 'description', 'website_url', 'industry', 'business_model',
      'service_area', 'service_category', 'primary_platform', 'content_niche',
      'cause_area', 'organization_type'];
    for (var i = 0; i < fields.length; i++) {
      if (sc[fields[i]]) id[fields[i]] = sc[fields[i]];
    }
  }

  function syncToTextarea() {
    // C3 FIX: Always merge seed context into identity module before save
    _mergeSeedIntoIdentity();

    var payload = {};
    payload.meta = {
      schema_version: SCHEMA_VERSION,
      brand_level: W.brandLevel,
      brand_types: W.brandTypes,
      brand_subtypes: W.brandSubtypes,
      language: W.language,
      wizard_status: 'in_progress',
      wizard_progress: {
        completed_steps: W.completedSteps,
        current_step: W.currentStepId,
        skipped_steps: W.skippedSteps
      },
      modules_enabled: getEnabledModules(),
      detection_answers: deepClone(W.detection),
      created: (W.data.meta && W.data.meta.created) || now(),
      last_modified: now(),
      ai_provider_used: W.aiProvider,
      ai_model_used: W.aiModel
    };

    var accepted = W.acceptedSections || {};
    for (var k in accepted) {
      if (accepted.hasOwnProperty(k)) payload[k] = accepted[k];
    }

    payload._wizard_state = {
      seed_context: W.seedContext,
      imported_assets: W.importedAssets,
      discovery_answers: W.discoveryAnswers,
      generated_sections: W.generatedSections,
      section_states: W.sectionStates,
      identity_phase: W._identityPhase,
      audience_phase: W._audiencePhase,
      activity_log: W.activityLog
    };

    payload.ai_preferences = {
      default_provider: W.aiProvider,
      default_model: W.aiModel,
      custom_instructions: ''
    };

    W.$textarea.val(JSON.stringify(payload));
    W.lastSaved = now();
    W.dirty = false;
    console.log(LOG_PREFIX, 'Auto-saved. Step:', W.currentStepId);
    if (window._bpwAppShell_dirtyHook) window._bpwAppShell_dirtyHook();
  }

  var _debouncedSave = debounce(function() { syncToTextarea(); }, 1000);

  function autoSave() {
    W.dirty = true;
    if (window._bpwAppShell_dirtyHook) window._bpwAppShell_dirtyHook();
    _debouncedSave();
  }

  function buildFinalProfile() {
    // S5 FIX: Always merge seed data before building final
    _mergeSeedIntoIdentity();

    var payload = deepClone(W.acceptedSections || {});
    payload.meta = {
      schema_version: SCHEMA_VERSION,
      brand_level: W.brandLevel,
      brand_types: W.brandTypes,
      brand_subtypes: W.brandSubtypes,
      language: W.language,
      wizard_status: 'complete',
      wizard_progress: {
        completed_steps: W.completedSteps,
        current_step: 'review',
        skipped_steps: W.skippedSteps
      },
      modules_enabled: getEnabledModules(),
      detection_answers: deepClone(W.detection),
      created: (W.data.meta && W.data.meta.created) || now(),
      last_modified: now(),
      ai_provider_used: W.aiProvider,
      ai_model_used: W.aiModel
    };
    if (W.importedAssets && Object.keys(W.importedAssets).length) {
      payload.imported_assets = W.importedAssets;
    }
    // S9 FIX: Preserve wizard state for resume/re-edit capability
    payload._wizard_state = {
      seed_context: W.seedContext,
      imported_assets: W.importedAssets,
      discovery_answers: W.discoveryAnswers,
      generated_sections: W.generatedSections,
      section_states: W.sectionStates,
      identity_phase: W._identityPhase,
      audience_phase: W._audiencePhase,
      activity_log: W.activityLog
    };
    payload.ai_preferences = {
      default_provider: W.aiProvider,
      default_model: W.aiModel,
      custom_instructions: ''
    };
    return payload;
  }

  // ============================================================
  // SECTION 10B: EXPORT FIELD POPULATION
  // ============================================================

  var EXPORT_FIELD_SELECTORS = {
    core:    ['#edit-field-brand-core-0-value', 'textarea[name="field_brand_core[0][value]"]', '[data-drupal-selector="edit-field-brand-core-0-value"]', '.field--name-field-brand-core textarea'],
    video:   ['#edit-field-brand-video-0-value', 'textarea[name="field_brand_video[0][value]"]', '[data-drupal-selector="edit-field-brand-video-0-value"]', '.field--name-field-brand-video textarea'],
    content: ['#edit-field-brand-content-0-value', 'textarea[name="field_brand_content[0][value]"]', '[data-drupal-selector="edit-field-brand-content-0-value"]', '.field--name-field-brand-content textarea'],
    seo:     ['#edit-field-brand-seo-0-value', 'textarea[name="field_brand_seo[0][value]"]', '[data-drupal-selector="edit-field-brand-seo-0-value"]', '.field--name-field-brand-seo textarea'],
    social:  ['#edit-field-brand-social-0-value', 'textarea[name="field_brand_social[0][value]"]', '[data-drupal-selector="edit-field-brand-social-0-value"]', '.field--name-field-brand-social textarea'],
    meta:    ['#edit-field-json-meta-0-value', 'textarea[name="field_json_meta[0][value]"]', '[data-drupal-selector="edit-field-json-meta-0-value"]', '.field--name-field-json-meta textarea'],
    activity:['#edit-field-activity-log-0-value', 'textarea[name="field_activity_log[0][value]"]', '[data-drupal-selector="edit-field-activity-log-0-value"]', '.field--name-field-activity-log textarea']
  };

  function _findField(type) {
    var sels = EXPORT_FIELD_SELECTORS[type] || [];
    for (var i = 0; i < sels.length; i++) {
      var $el = $(sels[i]);
      if ($el.length) return $el;
    }
    // Wildcard fallback: search by partial name attribute
    var namePatterns = {
      core: 'brand_core', video: 'brand_video', content: 'brand_content',
      seo: 'brand_seo', social: 'brand_social', meta: 'json_meta', activity: 'activity_log'
    };
    if (namePatterns[type]) {
      var $wild = $('textarea[name*="' + namePatterns[type] + '"], input[name*="' + namePatterns[type] + '"]').first();
      if ($wild.length) return $wild;
    }
    return null;
  }

  // Helper: get social profiles for export.
  // New schema (W.acceptedSections.social.profiles) is authoritative;
  // fall back to the legacy import-side cache for older saves that
  // never went through Phase 4's setup workflow.
  function _exportSocialProfiles() {
    var primary = ((W.acceptedSections || {}).social || {}).profiles;
    var src = Array.isArray(primary) && primary.length
      ? primary
      : (W.importedAssets.social_profiles || []);
    return src
      .filter(function(sp) { return sp && (sp.url || sp.handle); })
      .map(function(sp) { return { platform: sp.platform || '', url: sp.url || '', handle: sp.handle || '' }; });
  }

  function buildV2ExportContext(type) {
    _ensureModulesAssembled();
    _mergeSeedIntoIdentity();
    var acc = W.acceptedSections || {};
    var id = acc.identity || {};
    var v = acc.voice || {};
    var m = acc.messaging || {};
    var a = acc.audience || {};
    var o = acc.offerings || {};
    var mkt = acc.market || {};
    var cs = acc.content_strategy || {};
    var vocab = v.vocabulary || {};

    switch (type) {
      case 'core':
        var personas = a.personas || [];
        var fp = personas[0] || {};
        return {
          brand_name: id.name || '', website: id.website_url || '',
          tagline: id.tagline || '', mission: id.mission || '',
          vision: id.vision || '',
          industry: id.industry || '',
          business_description: id.description || W.seedContext.description || '',
          brand_archetype: id.brand_archetype || '',
          brand_voice: [v.primary_tone || ''].concat(v.personality_traits || []).filter(Boolean).join(', '),
          elevator_pitch: id.elevator_pitch || '',
          brand_level: W.brandLevel || '',
          brand_types: W.brandTypes || [],
          audience: {
            primary: a.primary_description || (fp.name ? fp.name + (fp.role ? ' — ' + fp.role : '') : ''),
            segments: (a.segments || []).map(function(s) { return s.name || s; }),
            pain: (fp.pain_points || []).slice(0, 3).join('; ')
          },
          social_profiles: _exportSocialProfiles(),
          differentiators: (mkt.differentiators || []).map(function(d) { return d.point || d; }).filter(Boolean),
          values: (id.values || []).map(function(val) { return val.value || val; }).filter(Boolean),
          dos: v.dos || [], donts: v.donts || [],
          preferred_terms: vocab.preferred_terms || [],
          avoided_terms: vocab.avoided_terms || [],
          primary_message: m.primary_message || '',
          supporting_messages: m.supporting_messages || []
        };

      case 'video':
        var vidPersonas = a.personas || [];
        var vidFp = vidPersonas[0] || {};
        return {
          channel: id.name || '',
          content_pillars: (cs.pillars || []).map(function(p) { return { pillar: p.pillar || p.name || p, topics: p.topics || [] }; }),
          video_tone: v.primary_tone || '',
          personality_traits: v.personality_traits || [],
          dos: v.dos || [],
          donts: v.donts || [],
          brand_voice_sample: v.sample_texts || '',
          preferred_terms: vocab.preferred_terms || [],
          avoided_terms: vocab.avoided_terms || [],
          headlines: (m.headlines || []).map(function(h) { return h.headline || h; }).filter(Boolean),
          primary_message: m.primary_message || '',
          target_audience: a.primary_description || '',
          target_persona: vidFp.name ? {
            name: vidFp.name, role: vidFp.role || '',
            pain_points: vidFp.pain_points || [],
            goals: vidFp.goals || []
          } : null,
          video_vocabulary: { preferred: vocab.preferred_terms || [], avoided: vocab.avoided_terms || [] }
        };

      case 'content':
        return {
          content_pillars: (cs.pillars || []).map(function(p) { return { pillar: p.pillar || p.name || p, description: p.description || '', topics: p.topics || [] }; }),
          channels: (cs.channels || []).map(function(c) { return { channel: c.channel || c, purpose: c.purpose || '', frequency: c.frequency || '' }; }),
          writing_tone: v.primary_tone || '',
          dos: v.dos || [],
          donts: v.donts || [],
          preferred_terms: vocab.preferred_terms || [],
          avoided_terms: vocab.avoided_terms || [],
          primary_message: m.primary_message || '',
          supporting_messages: m.supporting_messages || [],
          brand_voice_sample: v.sample_texts || '',
          seo_keywords: cs.seo_keywords || [],
          hashtags: cs.hashtags || [],
          target_audience: a.primary_description || '',
          personas: (a.personas || []).map(function(p) {
            return { name: p.name || '', role: p.role || '', pain_points: p.pain_points || [] };
          }),
          audience_pain_points: (a.personas || []).reduce(function(acc2, p) {
            return acc2.concat(p.pain_points || []);
          }, []).filter(function(v2, i2, self) { return self.indexOf(v2) === i2; })
        };

      case 'seo':
        return {
          domain: id.website_url || '',
          industry: id.industry || '',
          brand_name: id.name || '',
          keyword_clusters: (cs.seo_keywords || []).slice(0, 15).map(function(kw) {
            return { keyword: kw, seed: kw };
          }),
          competitor_analysis: (mkt.competitors || []).slice(0, 5).map(function(co) {
            return { name: co.name || '', strengths: co.strengths || [], weaknesses: co.weaknesses || [] };
          }),
          content_pillars: (cs.pillars || []).map(function(p) { return p.pillar || p.name || p; }),
          target_audience: a.primary_description || '',
          differentiators: (mkt.differentiators || []).map(function(d) { return d.point || d; }).filter(Boolean),
          market_category: mkt.category || '',
          positioning: mkt.positioning || '',
          social_profiles: _exportSocialProfiles(),
          persona_keywords: (a.personas || []).reduce(function(acc2, p) {
            return acc2.concat([p.role, p.name].filter(Boolean));
          }, [])
        };

      case 'social':
        var socialPersonas = a.personas || [];
        return {
          brand_name: id.name || '',
          primary_tone: v.primary_tone || '',
          personality_traits: v.personality_traits || [],
          dos: v.dos || [],
          donts: v.donts || [],
          primary_message: m.primary_message || '',
          supporting_messages: m.supporting_messages || [],
          headlines: (m.headlines || []).map(function(h) { return { context: h.context || '', headline: h.headline || h }; }),
          hashtags: cs.hashtags || [],
          preferred_terms: vocab.preferred_terms || [],
          avoided_terms: vocab.avoided_terms || [],
          target_audience: a.primary_description || '',
          content_pillars: (cs.pillars || []).map(function(p) { return p.pillar || p.name || p; }),
          brand_voice_sample: v.sample_texts || '',
          social_profiles: _exportSocialProfiles(),
          persona_content_ideas: socialPersonas.map(function(p) {
            return {
              persona: p.name || '',
              pain_points: p.pain_points || [],
              content_ideas: (p.goals || []).map(function(g) { return 'Help ' + (p.name || 'audience') + ' to ' + g; })
            };
          })
        };

      default: return {};
    }
  }

  function buildMetaExport() {
    return {
      schema_version: SCHEMA_VERSION,
      brand_level: W.brandLevel,
      brand_types: W.brandTypes,
      brand_subtypes: W.brandSubtypes,
      language: W.language,
      modules_enabled: getEnabledModules(),
      ai_provider: W.aiProvider,
      ai_model: W.aiModel,
      created: (W.data.meta && W.data.meta.created) || '',
      last_modified: now(),
      wizard_status: W.data.meta ? W.data.meta.wizard_status : 'in_progress'
    };
  }

  // Real-time activity logger
  function logActivity(action, details) {
    W.activityLog = W.activityLog || [];
    W.activityLog.push({
      action: action,
      details: details || {},
      timestamp: now()
    });
    // Keep log from growing unbounded (keep last 500 entries)
    if (W.activityLog.length > 500) W.activityLog = W.activityLog.slice(-500);
  }

  function buildActivityLog() {
    // Use real-time log if available, otherwise rebuild from state
    if (W.activityLog && W.activityLog.length > 0) return W.activityLog;

    var log = [];
    // Fallback: Build log from completedSteps and sectionStates
    for (var i = 0; i < W.completedSteps.length; i++) {
      var step = stepById(W.completedSteps[i]);
      log.push({
        action: 'step_completed',
        details: { step: W.completedSteps[i], label: step ? step.label : W.completedSteps[i] },
        timestamp: now()
      });
    }
    for (var key in W.sectionStates) {
      if (W.sectionStates.hasOwnProperty(key) && W.sectionStates[key] === 'accepted') {
        log.push({
          action: 'section_accepted',
          details: { section: key, source: W.generatedSections[key] ? 'ai' : 'manual' },
          timestamp: now()
        });
      }
    }
    return log;
  }

  function syncAllExportFields() {
    _ensureModulesAssembled();

    var types = ['core', 'video', 'content', 'seo', 'social'];
    var synced = 0, notFound = [];

    for (var i = 0; i < types.length; i++) {
      var $f = _findField(types[i]);
      if ($f) {
        var data = buildV2ExportContext(types[i]);
        $f.val(JSON.stringify(data));
        synced++;
        console.log(LOG_PREFIX, 'Export synced:', types[i], '(' + JSON.stringify(data).length + ' chars)');
      } else {
        notFound.push('brand_' + types[i]);
      }
    }

    // Meta field
    var $meta = _findField('meta');
    if ($meta) {
      $meta.val(JSON.stringify(buildMetaExport()));
      synced++;
    } else { notFound.push('json_meta'); }

    // Activity log field
    var $activity = _findField('activity');
    if ($activity) {
      $activity.val(JSON.stringify(buildActivityLog()));
      synced++;
    } else { notFound.push('activity_log'); }

    console.log(LOG_PREFIX, 'Export fields synced:', synced + '/7');
    if (notFound.length) {
      console.log(LOG_PREFIX, 'Export fields NOT found in DOM:', notFound.join(', '),
        '— These fields may not exist on this content type or have different machine names.');
    }
  }

  function _setDrupalTitle() {
    // Drupal may require a Title field for node creation.
    // Fill it from brand name if available.
    var brandName = (W.seedContext.name || '').trim();
    if (!brandName) brandName = 'Brand Profile';
    var titleSels = [
      '#edit-title-0-value',
      'input[name="title[0][value]"]',
      '.field--name-title input[type="text"]',
      'input[data-drupal-selector="edit-title-0-value"]'
    ];
    for (var i = 0; i < titleSels.length; i++) {
      var $t = $(titleSels[i]);
      if ($t.length) {
        if (!$t.val() || !$t.val().trim()) {
          $t.val(brandName);
          console.log(LOG_PREFIX, 'Set Drupal title to:', brandName);
        }
        return;
      }
    }
  }

  function drupalSave(silent) {
    syncToTextarea();
    _setDrupalTitle();
    syncAllExportFields();

    if (!W.$submitBtn || !W.$submitBtn.length) {
      // Try to find submit button again (might have been re-rendered)
      W.$submitBtn = $('form[class*="node-brand-profile"] #edit-submit, form[class*="node-brand-profile"] [data-drupal-selector="edit-submit"], .form-actions input[type="submit"]').first();
    }

    if (W.$submitBtn && W.$submitBtn.length) {
      if (!silent) toast('Saving to Drupal...', 'info');
      // Temporarily make form interactive for submission
      var $form = W.$submitBtn.closest('form');
      $form.css('pointer-events', 'auto');
      W.$submitBtn.click();
    } else {
      console.warn(LOG_PREFIX, 'No submit button found. Data saved to textarea only.');
      if (!silent) toast('Saved to textarea. Use Drupal Save button to persist.', 'warning');
    }
  }

  function saveProgress() {
    // Collect any current form data first
    _collectCurrentStepFields();
    syncToTextarea();
    _setDrupalTitle();
    drupalSave(false);
  }

  function _collectCurrentStepFields() {
    var step = W.currentStepId;
    if (step === 'basics') {
      $('.bpw-step-card [data-field]').each(function() {
        var f = $(this).data('field');
        if (f && f !== 'ai-provider-setup' && f !== 'ai-model-setup' && f !== 'ai-provider' && f !== 'ai-model' && f !== 'language') {
          W.seedContext[f] = $(this).val();
        }
      });
    } else if (step === 'import') {
      var pd = $('[data-field="pasted_documents"]').val();
      if (pd !== undefined) W.importedAssets.pasted_documents = pd;
    } else if (step === 'discovery') {
      $('[data-field^="discovery-text-"]').each(function() {
        var qid = $(this).data('field').replace('discovery-text-', '');
        W.discoveryAnswers[qid] = W.discoveryAnswers[qid] || {};
        W.discoveryAnswers[qid].text = $(this).val();
      });
    }
  }

  // ============================================================
  // SECTION 22: SCREEN — REVIEW & COMPLETE
  // ============================================================


  function _ensureModulesAssembled() {
    var AMAP = window._bpwPart2B ? window._bpwPart2B.ASSEMBLY_MAP : null;
    if (!AMAP) {
      AMAP = {
        identity_mission: { module: 'identity', field: 'mission' },
        identity_vision: { module: 'identity', field: 'vision' },
        identity_values: { module: 'identity', field: 'values' },
        identity_archetype: { module: 'identity', field: 'brand_archetype' },
        identity_pitch: { module: 'identity', field: 'elevator_pitch' },
        voice_tone: { module: 'voice', field: 'primary_tone' },
        voice_personality: { module: 'voice', field: 'personality_traits' },
        voice_dos: { module: 'voice', field: 'dos' },
        voice_donts: { module: 'voice', field: 'donts' },
        voice_preferred: { module: 'voice', field: 'vocabulary.preferred_terms' },
        voice_avoided: { module: 'voice', field: 'vocabulary.avoided_terms' },
        voice_sample: { module: 'voice', field: 'sample_texts' },
        messaging_primary: { module: 'messaging', field: 'primary_message' },
        messaging_supporting: { module: 'messaging', field: 'supporting_messages' },
        messaging_headlines: { module: 'messaging', field: 'headlines' },
        audience_primary: { module: 'audience', field: 'primary_description' },
        audience_segments: { module: 'audience', field: 'segments' },
        audience_personas: { module: 'audience', field: 'personas' },
        market_category: { module: 'market', field: 'category' },
        market_positioning: { module: 'market', field: 'positioning' },
        market_competitors: { module: 'market', field: 'competitors' },
        market_differentiators: { module: 'market', field: 'differentiators' },
        market_trends: { module: 'market', field: 'trends' },
        market_opportunities: { module: 'market', field: 'opportunities' },
        offerings_items: { module: 'offerings', field: 'items' },
        offerings_content: { module: 'offerings', field: 'content_description' },
        offerings_pricing: { module: 'offerings', field: 'pricing_model' },
        offerings_programs: { module: 'offerings', field: 'programs' },
        offerings_revenue: { module: 'offerings', field: 'revenue_streams' },
        content_pillars: { module: 'content_strategy', field: 'pillars' },
        content_channels: { module: 'content_strategy', field: 'channels' },
        content_seo: { module: 'content_strategy', field: 'seo_keywords' },
        content_hashtags: { module: 'content_strategy', field: 'hashtags' }
      };
    }

    W.acceptedSections = W.acceptedSections || {};
    W.generatedSections = W.generatedSections || {};

    // Assemble EVERY flat key that has data, filling in missing module fields
    var sources = [W.acceptedSections, W.generatedSections];
    for (var si = 0; si < sources.length; si++) {
      var src = sources[si] || {};
      for (var key in src) {
        if (!src.hasOwnProperty(key)) continue;
        var mapping = AMAP[key];
        if (!mapping || mapping.module === '_internal') continue;
        var mod = mapping.module;
        var field = mapping.field;
        var data = src[key];
        if (data === undefined || data === null || data === '') continue;

        W.acceptedSections[mod] = W.acceptedSections[mod] || {};

        // Check if this SPECIFIC field already has data — don't overwrite
        if (field.indexOf('.') !== -1) {
          var parts = field.split('.');
          var target = W.acceptedSections[mod];
          for (var p = 0; p < parts.length - 1; p++) {
            target[parts[p]] = target[parts[p]] || {};
            target = target[parts[p]];
          }
          var leaf = parts[parts.length - 1];
          if (target[leaf] === undefined || target[leaf] === null || target[leaf] === '' || (Array.isArray(target[leaf]) && target[leaf].length === 0)) {
            target[leaf] = data;
          }
        } else {
          var existing = W.acceptedSections[mod][field];
          if (existing === undefined || existing === null || existing === '' || (Array.isArray(existing) && existing.length === 0)) {
            W.acceptedSections[mod][field] = data;
          }
        }
      }
    }
    _mergeSeedIntoIdentity();
  }

  // ============================================================
  // SECTION 23: LLM SERVICE
  // ============================================================

  var LLMService = (function() {
    var _config = null, _providerMap = {};

    function _decodeEntities(text) {
      if (!text) return '';
      var el = document.createElement('textarea');
      el.innerHTML = text;
      return el.value;
    }

    function _tryParseConfig($el) {
      if (!$el || !$el.length) return null;
      // Try 1: jQuery .text() (decodes basic entities)
      var raw = $el.text();
      if (raw && raw.trim()) {
        try { return JSON.parse(raw.trim()); } catch(e) {}
      }
      // Try 2: DOM textContent directly
      raw = $el[0].textContent;
      if (raw && raw.trim()) {
        try { return JSON.parse(raw.trim()); } catch(e) {}
      }
      // Try 3: innerHTML with manual entity decode (handles double-encoding)
      raw = _decodeEntities($el.html());
      if (raw && raw.trim()) {
        try { return JSON.parse(raw.trim()); } catch(e) {}
      }
      // Try 4: innerHTML decoded twice (for triple encoding)
      raw = _decodeEntities(_decodeEntities($el.html()));
      if (raw && raw.trim()) {
        try { return JSON.parse(raw.trim()); } catch(e) {}
      }
      console.warn(LOG_PREFIX, 'LLM config parse failed. Raw content (first 200 chars):', ($el.text() || '').substring(0, 200));
      return null;
    }

    function init() {
      _config = null; _providerMap = {};

      // Search for config in multiple locations
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
          console.log(LOG_PREFIX, 'LLM config div found via:', configSelectors[i]);
          // For script tags, parse differently
          if ($el.is('script')) {
            try { raw = JSON.parse($el.html().trim()); } catch(e) {}
          } else {
            raw = _tryParseConfig($el);
          }
          if (raw) break;
        }
      }

      if (!raw) {
        console.warn(LOG_PREFIX, 'LLM config: No config found in DOM. Scheduling retry...');
        setTimeout(function() { _retryInit(); }, 2000);
        return;
      }

      _processConfig(raw);
    }

    function _retryInit() {
      if (Object.keys(_providerMap).length > 0) return; // Already configured
      console.log(LOG_PREFIX, 'LLM config: Retry...');
      var selectors = ['.llm-brand-config-data', '.llm-config-data', '#llm-config-data', '[data-llm-config]'];
      for (var i = 0; i < selectors.length; i++) {
        var $el = $(selectors[i]);
        if ($el.length) {
          var raw = _tryParseConfig($el);
          if (raw) {
            _processConfig(raw);
            // Re-render to show AI picker
            if (render) render();
            return;
          }
        }
      }
      console.warn(LOG_PREFIX, 'LLM config: Retry failed. AI features will not be available.');
    }

    function _processConfig(raw) {
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
      // Set initial AI provider/model
      if (!W.aiProvider) {
        var def = _getDefault();
        if (def) { W.aiProvider = def.provider; W.aiModel = def.model; }
      }
      console.log(LOG_PREFIX, 'LLMService:', Object.keys(_providerMap).length, 'providers configured:',
        Object.keys(_providerMap).map(function(id) { return _providerMap[id].label + '(' + _providerMap[id].activeModels.length + ' models)'; }).join(', ')
      );
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
            if (p.activeModels[i].id === _config.default_model) return { provider: p.id, model: p.activeModels[i].id, api_key: p.api_key, temperature: p.activeModels[i].temperature, max_tokens: p.activeModels[i].max_tokens || 8192 };
          }
        }
      }
      var p0 = provs[0], m0 = p0.activeModels[0];
      return { provider: p0.id, model: m0.id, api_key: p0.api_key, temperature: m0.temperature, max_tokens: m0.max_tokens || 8192 };
    }

    function _getSelection() {
      var pid = W.aiProvider, mid = W.aiModel;
      var p = _providerMap[pid];
      if (!p) { var d = _getDefault(); return d; }
      for (var i = 0; i < p.activeModels.length; i++) {
        if (p.activeModels[i].id === mid) return { provider: pid, model: mid, api_key: p.api_key, temperature: p.activeModels[i].temperature !== undefined ? p.activeModels[i].temperature : 1.0, max_tokens: p.activeModels[i].max_tokens || 8192 };
      }
      return { provider: pid, model: p.activeModels[0].id, api_key: p.api_key, temperature: p.activeModels[0].temperature || 1.0, max_tokens: p.activeModels[0].max_tokens || 8192 };
    }

    function callAI(prompt, onSuccess, onError, systemPrompt) {
      var cfg = _getSelection();
      if (!cfg || !cfg.api_key) { if (onError) onError('No AI providers configured. Go to Settings.'); return; }
      var prov = cfg.provider, model = cfg.model, key = cfg.api_key;
      var ep = AI_ENDPOINTS[prov];
      if (!ep) { if (onError) onError('Unknown provider: ' + prov); return; }
      systemPrompt = systemPrompt || '';
      var body, headers;

      switch (prov) {
        case 'gemini':
          ep = ep.replace('{MODEL}', model) + '?key=' + key;
          headers = { 'Content-Type': 'application/json' };
          body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: cfg.max_tokens, temperature: cfg.temperature || 1.0, topP: 0.95, responseMimeType: 'application/json' } };
          if (systemPrompt) body.system_instruction = { parts: [{ text: systemPrompt }] };
          break;
        case 'claude':
          headers = { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
          body = { model: model, max_tokens: cfg.max_tokens, messages: [{ role: 'user', content: prompt }] };
          if (cfg.temperature !== undefined) body.temperature = cfg.temperature;
          if (systemPrompt) body.system = systemPrompt;
          break;
        default:
          headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key };
          if (prov === 'openrouter') { headers['HTTP-Referer'] = window.location.origin; headers['X-Title'] = 'Brand Profile Wizard'; }
          body = { model: model, max_tokens: cfg.max_tokens, messages: [{ role: 'user', content: prompt }], temperature: cfg.temperature || 1.0 };
          if (systemPrompt) body.messages = [{ role: 'system', content: systemPrompt }].concat(body.messages);
          if (prov === 'groq' && body.temperature === 0) body.temperature = 0.01;
          break;
      }

      console.log(LOG_PREFIX, 'AI call:', prov + '/' + model);
      // W.isAIProcessing is owned by callers — _runPromptsSequential
      // (bpw-part2a.js:347-362) sets/clears it for the entire batch.
      // Touching it here would clear the batch guard after the first
      // prompt and let duplicate submissions slip through.

      fetch(ep, { method: 'POST', headers: headers, body: JSON.stringify(body) })
        .then(function(res) {
          if (!res.ok) return res.text().then(function(t) {
            var msg = 'API ' + res.status;
            try { msg = JSON.parse(t).error.message || msg; } catch (e) {}
            throw new Error(msg);
          });
          return res.json();
        })
        .then(function(data) {
          var txt = _extractText(prov, data);
          console.log(LOG_PREFIX, 'AI response:', txt.substring(0, 200));
          if (onSuccess) onSuccess(txt);
        })
        .catch(function(err) {
          console.error(LOG_PREFIX, 'AI error:', err);
          if (onError) onError(err.message || 'Request failed');
        });
    }

    function _extractText(prov, data) {
      try {
        if (prov === 'gemini') {
          if (data.candidates && data.candidates[0] && data.candidates[0].content) return data.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('');
          return JSON.stringify(data);
        }
        if (prov === 'claude') return data.content ? data.content.filter(function(c) { return c.type === 'text'; }).map(function(c) { return c.text; }).join('') : '';
        return (data.choices && data.choices[0] && data.choices[0].message) ? data.choices[0].message.content || '' : '';
      } catch (e) { return JSON.stringify(data); }
    }

    function renderPicker() {
      if (!isConfigured()) return '<span class="bpw-ai-no-config">' + icon('triangle-exclamation') + ' No AI configured</span>';
      var provs = getActiveProviders();
      var h = '<select class="bpw-header-select" data-field="ai-provider">';
      for (var i = 0; i < provs.length; i++) h += '<option value="' + esc(provs[i].id) + '"' + (W.aiProvider === provs[i].id ? ' selected' : '') + '>' + esc(provs[i].label) + '</option>';
      h += '</select>';
      h += '<select class="bpw-header-select" data-field="ai-model">';
      var models = getActiveModels(W.aiProvider);
      for (var j = 0; j < models.length; j++) h += '<option value="' + esc(models[j].id) + '"' + (W.aiModel === models[j].id ? ' selected' : '') + '>' + esc(models[j].label || models[j].id) + '</option>';
      h += '</select>';
      return h;
    }

    function renderProviderSelect() {
      if (!isConfigured()) return '<div class="bpw-hint">' + icon('triangle-exclamation') + ' No AI providers configured</div>';
      var provs = getActiveProviders();
      var h = '<select class="bpw-select" data-field="ai-provider-setup">';
      for (var i = 0; i < provs.length; i++) h += '<option value="' + esc(provs[i].id) + '"' + (W.aiProvider === provs[i].id ? ' selected' : '') + '>' + esc(provs[i].label) + '</option>';
      h += '</select>';
      return h;
    }

    function renderModelSelect() {
      var models = getActiveModels(W.aiProvider);
      if (!models.length) return '<select class="bpw-select" disabled><option>No models</option></select>';
      var h = '<select class="bpw-select" data-field="ai-model-setup">';
      for (var j = 0; j < models.length; j++) h += '<option value="' + esc(models[j].id) + '"' + (W.aiModel === models[j].id ? ' selected' : '') + '>' + esc(models[j].label || models[j].id) + '</option>';
      h += '</select>';
      return h;
    }

    return { init: init, isConfigured: isConfigured, getActiveProviders: getActiveProviders, getActiveModels: getActiveModels, callAI: callAI, renderPicker: renderPicker, renderProviderSelect: renderProviderSelect, renderModelSelect: renderModelSelect };
  })();

  // ============================================================
  // SECTION 24: AI PIPELINE
  // ============================================================

  function buildAIContext() {
    return {
      brand_level: W.brandLevel,
      brand_types: W.brandTypes,
      brand_subtypes: W.brandSubtypes,
      language: W.language,
      seed: W.seedContext,
      imported: W.importedAssets,
      discovery: W.discoveryAnswers,
      accepted: W.acceptedSections
    };
  }

  function getLangInstruction() {
    if (!W.language || W.language === 'en') return '';
    var name = LANG_NAMES[W.language] || W.language;
    return '\n\nIMPORTANT: Generate ALL content in ' + name + '. JSON keys remain in English. Only values should be in ' + name + '.';
  }

  function parseAIResponse(rawText) {
    if (!rawText || !rawText.trim()) return { success: false, error: 'Empty AI response', rawText: '' };
    try { return { success: true, data: JSON.parse(rawText) }; } catch (e) {}
    var cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    try { return { success: true, data: JSON.parse(cleaned) }; } catch (e) {}
    var s = cleaned.indexOf('{');
    if (s === -1) s = cleaned.indexOf('[');
    if (s !== -1) {
      var open = cleaned.charAt(s), close = open === '{' ? '}' : ']';
      var depth = 0, inStr = false, escNext = false;
      for (var i = s; i < cleaned.length; i++) {
        var ch = cleaned.charAt(i);
        if (escNext) { escNext = false; continue; }
        if (ch === '\\') { escNext = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === open) depth++;
        if (ch === close) { depth--; if (depth === 0) { try { return { success: true, data: JSON.parse(cleaned.substring(s, i + 1)) }; } catch (e2) { break; } } }
      }
    }
    return { success: false, error: 'Could not parse AI response', rawText: rawText };
  }

  function setSectionState(key, state) {
    W.sectionStates[key] = state;
  }

  function acceptSection(key, data) {
    // Fix 1: Delegate to Part 2B assembly override if available
    if (window._bpwAcceptSectionOverride) {
      window._bpwAcceptSectionOverride(key, data);
      return;
    }
    // Fallback: store flat key only (no assembly)
    W.acceptedSections[key] = data;
    setSectionState(key, 'accepted');
    autoSave();
  }

  function rejectSection(key) {
    delete W.acceptedSections[key];
    setSectionState(key, 'rejected');
  }

  function renderAISection(key, title, bodyContent) {
    var state = W.sectionStates[key] || (bodyContent ? 'generated' : 'pending');
    var stInfo = SECTION_STATES[state] || SECTION_STATES.pending;
    var stClass = state === 'accepted' ? ' bpw-ais-accepted' : state === 'editing' ? ' bpw-ais-editing' : state === 'manual' ? ' bpw-ais-editing' : '';

    var h = '<div class="bpw-ai-section' + stClass + '" data-section-key="' + esc(key) + '">';
    h += '<div class="bpw-ais-header">';
    h += '<div class="bpw-ais-title">';
    if (state === 'accepted') h += icon('check-circle') + ' ';
    h += esc(title);
    if (state !== 'pending' && state !== 'manual') h += ' <span class="bpw-status-badge bpw-status-' + state + '">' + esc(stInfo.label) + '</span>';
    if (state === 'manual') h += ' <span class="bpw-status-badge bpw-status-editing">Editing</span>';
    h += '</div>';
    h += '<div class="bpw-ais-controls">';
    if (state === 'accepted') {
      h += '<button class="bpw-section-btn" data-action="copy-section" data-key="' + esc(key) + '" title="Copy to clipboard">' + icon('copy') + '</button>';
      h += '<button class="bpw-section-btn" data-action="manual-edit" data-key="' + esc(key) + '">' + icon('pen') + ' Edit</button>';
    } else if (state === 'generated' || state === 'editing') {
      h += '<button class="bpw-section-btn accept" data-action="accept-section" data-key="' + esc(key) + '">' + icon('check') + ' Accept</button>';
      h += '<button class="bpw-section-btn" data-action="copy-section" data-key="' + esc(key) + '" title="Copy to clipboard">' + icon('copy') + '</button>';
      h += '<button class="bpw-section-btn" data-action="manual-edit" data-key="' + esc(key) + '">' + icon('pen') + ' Edit</button>';
      h += '<button class="bpw-section-btn" data-action="redo-section" data-key="' + esc(key) + '">' + icon('rotate-right') + ' Redo</button>';
    } else if (state === 'manual') {
      h += '<button class="bpw-section-btn accept" data-action="save-manual" data-key="' + esc(key) + '">' + icon('check') + ' Save</button>';
      h += '<button class="bpw-section-btn" data-action="cancel-manual" data-key="' + esc(key) + '">' + icon('xmark') + ' Cancel</button>';
    } else if (state === 'loading') {
      h += '<span class="bpw-ais-loading">' + icon('spinner fa-spin') + ' Generating...</span>';
    }
    h += '</div></div>';

    h += '<div class="bpw-ais-body">';
    if (state === 'loading') {
      h += '<div class="bpw-skeleton" style="height:14px;width:80%;margin-bottom:8px"></div>';
      h += '<div class="bpw-skeleton" style="height:14px;width:60%;margin-bottom:8px"></div>';
      h += '<div class="bpw-skeleton" style="height:14px;width:70%"></div>';
    } else if (state === 'manual') {
      h += _renderManualEditor(key);
    } else if (state === 'pending') {
      h += '<div class="bpw-ais-pending">' + icon('circle') + ' Will be generated by AI</div>';
      h += '<div class="bpw-ais-write-own"><button class="bpw-section-btn" data-action="manual-edit" data-key="' + esc(key) + '">' + icon('pen-to-square') + ' Write my own</button></div>';
    } else if (bodyContent) {
      h += typeof bodyContent === 'string' ? bodyContent : esc(JSON.stringify(bodyContent));
    }
    h += '</div></div>';
    return h;
  }

  // Section type map — determines editor type
  var SECTION_TYPES = {
    // Text fields
    identity_mission: 'text', identity_vision: 'text', identity_archetype: 'text',
    identity_pitch: 'textarea', voice_tone: 'textarea', voice_sample: 'textarea',
    messaging_primary: 'text', market_category: 'text', market_positioning: 'textarea',
    audience_primary: 'textarea', offerings_content: 'textarea', offerings_pricing: 'text',
    // List fields (one item per line)
    voice_dos: 'list', voice_donts: 'list', voice_preferred: 'list', voice_avoided: 'list',
    messaging_supporting: 'list', messaging_headlines: 'list',
    content_seo: 'list', content_hashtags: 'list',
    // Chip/trait lists
    voice_personality: 'chips',
    // Complex arrays (JSON but with helper)
    identity_values: 'values', identity_mission_options: 'list',
    market_competitors: 'json', market_differentiators: 'json',
    market_trends: 'list', market_opportunities: 'list',
    audience_segments: 'json', audience_personas: 'json',
    offerings_items: 'json', offerings_programs: 'json',
    offerings_revenue: 'list',
    content_pillars: 'json', content_channels: 'json'
  };

  function _renderManualEditor(key) {
    var type = SECTION_TYPES[key] || 'textarea';
    var current = W.generatedSections[key] || W.acceptedSections[key] || '';
    var h = '';

    if (type === 'text') {
      var val = typeof current === 'string' ? current : '';
      h += '<input class="bpw-input bpw-manual-input" data-manual-key="' + esc(key) + '" type="text" value="' + esc(val) + '" placeholder="Type here...">';
    } else if (type === 'textarea') {
      var val2 = typeof current === 'string' ? current : '';
      h += '<textarea class="bpw-textarea bpw-manual-input" data-manual-key="' + esc(key) + '" rows="4" placeholder="Type here...">' + esc(val2) + '</textarea>';
    } else if (type === 'list') {
      var items = _toList(current);
      h += '<div class="bpw-manual-hint">One item per line</div>';
      h += '<textarea class="bpw-textarea bpw-manual-input" data-manual-key="' + esc(key) + '" data-type="list" rows="6" placeholder="Item 1\nItem 2\nItem 3">' + esc(items.join('\n')) + '</textarea>';
    } else if (type === 'chips') {
      var chips = _toList(current);
      h += '<div class="bpw-manual-hint">Comma-separated</div>';
      h += '<input class="bpw-input bpw-manual-input" data-manual-key="' + esc(key) + '" data-type="chips" type="text" value="' + esc(chips.join(', ')) + '" placeholder="trait1, trait2, trait3">';
    } else if (type === 'values') {
      var vals = Array.isArray(current) ? current : [];
      h += '<div class="bpw-manual-hint">One value per line (format: Value Name | Description)</div>';
      var lines = vals.map(function(v) { return (v.value || v.name || '') + ' | ' + (v.description || ''); });
      h += '<textarea class="bpw-textarea bpw-manual-input" data-manual-key="' + esc(key) + '" data-type="values" rows="6" placeholder="Integrity | Always do the right thing\nInnovation | Push boundaries">' + esc(lines.join('\n')) + '</textarea>';
    } else {
      // JSON — show formatted with helper text
      var jsonStr = typeof current === 'object' ? JSON.stringify(current, null, 2) : (current || '');
      h += '<div class="bpw-manual-hint">Advanced: Edit as JSON</div>';
      h += '<textarea class="bpw-textarea bpw-manual-input bpw-manual-json" data-manual-key="' + esc(key) + '" data-type="json" rows="8">' + esc(jsonStr) + '</textarea>';
    }
    return h;
  }

  function _toList(val) {
    if (Array.isArray(val)) return val.map(function(v) { return typeof v === 'string' ? v : (v.text || v.name || v.headline || v.value || JSON.stringify(v)); });
    if (typeof val === 'string') return val.split('\n').filter(function(s) { return s.trim(); });
    return [];
  }

  function _parseManualValue(key, rawVal) {
    var type = SECTION_TYPES[key] || 'textarea';
    if (type === 'text' || type === 'textarea') return rawVal;
    if (type === 'list') return rawVal.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
    if (type === 'chips') return rawVal.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    if (type === 'values') {
      return rawVal.split('\n').filter(function(s) { return s.trim(); }).map(function(line) {
        var parts = line.split('|');
        return { value: (parts[0] || '').trim(), description: (parts[1] || '').trim() };
      });
    }
    if (type === 'json') {
      try { return JSON.parse(rawVal); } catch(e) { return rawVal; }
    }
    return rawVal;
  }

  function renderAlternativePicker(key, title, options, selected) {
    var state = W.sectionStates[key] || (options ? 'generated' : 'pending');
    if (state === 'pending' && !options) return renderAISection(key, title, null);

    var h = '<div class="bpw-ai-section" data-section-key="' + esc(key) + '">';
    h += '<div class="bpw-ais-header"><div class="bpw-ais-title">' + icon('bullseye') + ' ' + esc(title) + ' \u2014 choose one</div>';
    h += '<div class="bpw-ais-controls"><button class="bpw-section-btn" data-action="redo-section" data-key="' + esc(key) + '">' + icon('rotate-right') + ' Regenerate</button></div></div>';
    h += '<div class="bpw-ais-body">';

    if (Array.isArray(options)) {
      for (var i = 0; i < options.length; i++) {
        var sel = selected === options[i] || (!selected && i === 0);
        h += '<div class="bpw-alt-option' + (sel ? ' selected' : '') + '" data-action="select-alt" data-key="' + esc(key) + '" data-index="' + i + '">';
        h += '<div class="bpw-alt-label">Option ' + String.fromCharCode(65 + i) + '</div>';
        h += '<div class="bpw-alt-text">' + esc(options[i]) + '</div>';
        h += '</div>';
      }
    }

    h += '<div class="bpw-alt-option" data-action="select-alt-custom" data-key="' + esc(key) + '">';
    h += '<div class="bpw-alt-label">' + icon('pen') + ' Write my own</div>';
    h += '<div class="bpw-alt-text"><input class="bpw-input" data-field="alt-custom-' + esc(key) + '" placeholder="Type your own..." style="border:none;padding:0;font-size:inherit"></div>';
    h += '</div>';

    h += '</div></div>';
    return h;
  }

  // ============================================================
  // SECTION 25: EVENT HANDLERS & EXPORTS
  // ============================================================

  // The legacy step renderers (welcome / detect / basics / import /
  // discovery / market / identity / voice / audience / offerings /
  // content / review) were removed in the autopilot rebuild — their
  // replacements live in src/setup/ (autopilot takeover) and src/ui/
  // (post-setup three-pane shell). STEP_RENDERERS is kept as an empty
  // map so render() can hit the "screen not found" fallback if the
  // user ever navigates to a step id that no longer exists.
  var STEP_RENDERERS = {};

  function setupGlobalEvents() {
    $(document).off('click.bpw-nav').on('click.bpw-nav', '[data-action="go-next"]', function(e) {
      e.preventDefault();
      var check = canProceed();
      if (!check.ok) { toast(check.msg, 'warning'); return; }
      goNext();
    });

    $(document).off('click.bpw-prev').on('click.bpw-prev', '[data-action="go-prev"]', function(e) {
      e.preventDefault();
      goPrev();
    });

    $(document).off('click.bpw-skip').on('click.bpw-skip', '[data-action="skip-step"]', function(e) {
      e.preventDefault();
      skipStep();
    });

    $(document).off('click.bpw-step').on('click.bpw-step', '[data-action="go-step"]', function(e) {
      e.preventDefault();
      var stepId = $(this).data('step');
      if (!stepId) return;
      if ($(this).data('locked')) {
        toast('Complete earlier steps first to unlock this step.', 'info');
        return;
      }
      var idx = stepIndex();
      var targetIdx = -1;
      for (var i = 0; i < W.steps.length; i++) {
        if (W.steps[i].id === stepId) { targetIdx = i; break; }
      }
      var isReachable = W.completedSteps.indexOf(stepId) !== -1
        || stepId === W.currentStepId
        || targetIdx <= idx
        || (stepId === 'review' && _isReviewReachable());
      if (isReachable) {
        _collectCurrentStepFields();
        goStep(stepId);
      } else {
        toast('Complete earlier steps first to unlock this step.', 'info');
      }
    });

    // Header AI picker
    $(document).off('change.bpw-ai-provider').on('change.bpw-ai-provider', '[data-field="ai-provider"], [data-field="ai-provider-setup"]', function() {
      W.aiProvider = $(this).val();
      var models = LLMService.getActiveModels(W.aiProvider);
      if (models.length) W.aiModel = models[0].id;
      render();
    });

    $(document).off('change.bpw-ai-model').on('change.bpw-ai-model', '[data-field="ai-model"], [data-field="ai-model-setup"]', function() {
      W.aiModel = $(this).val();
    });

    // Save progress button
    $(document).off('click.bpw-save-progress').on('click.bpw-save-progress', '[data-action="save-progress"]', function(e) {
      e.preventDefault();
      saveProgress();
    });

    // Section controls
    $(document).off('click.bpw-section-accept').on('click.bpw-section-accept', '[data-action="accept-section"]', function() {
      var key = $(this).data('key');
      if (key && W.generatedSections[key]) {
        acceptSection(key, W.generatedSections[key]);
        render();
        toast('Section accepted', 'success');
      }
    });

    // Redo section — Part 2A handles this; fallback toast if Part 2A not loaded
    $(document).off('click.bpw-section-redo').on('click.bpw-section-redo', '[data-action="redo-section"]', function() {
      if (!window._bpwPart2A || !window._bpwPart2A.initialized) {
        toast('AI redo requires Part 2A. Check Asset Injector.', 'warning');
      }
    });

    // Manual edit — open inline editor
    $(document).off('click.bpw-manual-edit').on('click.bpw-manual-edit', '[data-action="manual-edit"]', function(e) {
      e.preventDefault();
      var key = $(this).data('key');
      if (!key) return;
      setSectionState(key, 'manual');
      render();
      // Focus the editor
      setTimeout(function() { $('.bpw-manual-input[data-manual-key="' + key + '"]').focus(); }, 100);
    });

    // Save manual edit
    $(document).off('click.bpw-save-manual').on('click.bpw-save-manual', '[data-action="save-manual"]', function(e) {
      e.preventDefault();
      var key = $(this).data('key');
      if (!key) return;
      var $input = $('.bpw-manual-input[data-manual-key="' + key + '"]');
      if (!$input.length) return;
      var rawVal = $input.val();
      var parsed = _parseManualValue(key, rawVal);
      W.generatedSections[key] = parsed;
      acceptSection(key, parsed);
      toast('Saved: ' + key.replace(/_/g, ' '), 'success');
      render();
    });

    // Cancel manual edit
    $(document).off('click.bpw-cancel-manual').on('click.bpw-cancel-manual', '[data-action="cancel-manual"]', function(e) {
      e.preventDefault();
      var key = $(this).data('key');
      if (!key) return;
      // Revert to previous state
      if (W.generatedSections[key]) {
        setSectionState(key, W.acceptedSections[key] ? 'accepted' : 'generated');
      } else {
        setSectionState(key, 'pending');
      }
      render();
    });

    // Add offering manually
    $(document).off('click.bpw-add-offering').on('click.bpw-add-offering', '[data-action="add-offering"]', function(e) {
      e.preventDefault();
      _openSimpleAddForm('offerings_items', 'Add Offering', [
        { field: 'name', label: 'Name', type: 'text', placeholder: 'e.g., SEO Workflow App' },
        { field: 'category', label: 'Category', type: 'text', placeholder: 'e.g., SaaS Tool, Service, Course' },
        { field: 'description', label: 'Description', type: 'textarea', placeholder: 'What it does and who it helps...' }
      ]);
    });

    // Add persona manually
    $(document).off('click.bpw-add-persona').on('click.bpw-add-persona', '[data-action="add-persona"]', function(e) {
      e.preventDefault();
      _openSimpleAddForm('audience_personas', 'Add Persona', [
        { field: 'name', label: 'Name', type: 'text', placeholder: 'e.g., Marketing Manager Maria' },
        { field: 'role', label: 'Role / Title', type: 'text', placeholder: 'e.g., Head of Marketing at a mid-size agency' },
        { field: 'pain_points', label: 'Pain points (one per line)', type: 'textarea', placeholder: 'Struggles with...\nWastes time on...' },
        { field: 'goals', label: 'Goals (one per line)', type: 'textarea', placeholder: 'Wants to...\nNeeds to...' }
      ]);
    });

    // G23: Copy section to clipboard
    $(document).off('click.bpw-copy-section').on('click.bpw-copy-section', '[data-action="copy-section"]', function(e) {
      e.preventDefault();
      var key = $(this).data('key');
      var data = W.generatedSections[key] || W.acceptedSections[key] || '';
      var text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          toast('Copied to clipboard', 'success');
        });
      } else {
        // Fallback
        var $tmp = $('<textarea>').val(text).appendTo('body').select();
        document.execCommand('copy');
        $tmp.remove();
        toast('Copied to clipboard', 'success');
      }
    });

    // Escape key — cancel manual edit
    $(document).off('keydown.bpw-manual-esc').on('keydown.bpw-manual-esc', function(e) {
      if (e.key === 'Escape') {
        var $manual = $('.bpw-manual-input');
        if ($manual.length) {
          var key = $manual.first().data('manual-key');
          if (key) {
            $('[data-action="cancel-manual"][data-key="' + key + '"]').trigger('click');
          }
        }
      }
    });
  }

  // Simple inline add form that appears above the add button
  function _openSimpleAddForm(sectionKey, title, fields) {
    // Check if form already open
    if ($('.bpw-add-form[data-for="' + sectionKey + '"]').length) {
      $('.bpw-add-form[data-for="' + sectionKey + '"]').remove();
      return;
    }

    var h = '<div class="bpw-add-form" data-for="' + esc(sectionKey) + '">';
    h += '<div class="bpw-add-form-title">' + icon('plus') + ' ' + esc(title) + '</div>';
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      h += '<div class="bpw-form-group"><label class="bpw-label">' + esc(f.label) + '</label>';
      if (f.type === 'textarea') {
        h += '<textarea class="bpw-textarea" data-add-field="' + esc(f.field) + '" rows="3" placeholder="' + esc(f.placeholder || '') + '"></textarea>';
      } else {
        h += '<input class="bpw-input" data-add-field="' + esc(f.field) + '" type="text" placeholder="' + esc(f.placeholder || '') + '">';
      }
      h += '</div>';
    }
    h += '<div class="bpw-add-form-actions">';
    h += '<button class="bpw-btn bpw-btn-sm bpw-btn-primary" data-action="save-add-item" data-section="' + esc(sectionKey) + '">' + icon('check') + ' Add</button>';
    h += '<button class="bpw-btn bpw-btn-sm bpw-btn-outline" data-action="cancel-add-item" data-section="' + esc(sectionKey) + '">Cancel</button>';
    h += '</div></div>';

    // Insert before the add-row button
    $('[data-action="add-offering"], [data-action="add-persona"]').filter(function() {
      return $(this).closest('.bpw-step-card').length;
    }).first().before(h);

    // Wire save/cancel
    $(document).off('click.bpw-save-add').on('click.bpw-save-add', '[data-action="save-add-item"]', function(e) {
      e.preventDefault();
      var sk = $(this).data('section');
      var $form = $('.bpw-add-form[data-for="' + sk + '"]');
      var item = {};
      $form.find('[data-add-field]').each(function() {
        var field = $(this).data('add-field');
        var val = $(this).val().trim();
        if (field === 'pain_points' || field === 'goals') {
          item[field] = val.split('\n').filter(function(s) { return s.trim(); });
        } else {
          item[field] = val;
        }
      });
      if (!item.name) { toast('Name is required', 'warning'); return; }
      item.id = generateId('item');

      // Add to generated sections
      W.generatedSections[sk] = W.generatedSections[sk] || [];
      if (!Array.isArray(W.generatedSections[sk])) W.generatedSections[sk] = [];
      W.generatedSections[sk].push(item);
      acceptSection(sk, W.generatedSections[sk]);
      toast('Added: ' + item.name, 'success');
      render();
    });

    $(document).off('click.bpw-cancel-add').on('click.bpw-cancel-add', '[data-action="cancel-add-item"]', function(e) {
      e.preventDefault();
      var sk = $(this).data('section');
      $('.bpw-add-form[data-for="' + sk + '"]').remove();
    });
  }


  // Toast
  function toast(msg, type) {
    type = type || 'info';
    var $t = $('<div class="bpw-toast bpw-toast-' + type + '">' + esc(msg) + '</div>');
    $('body').append($t);
    setTimeout(function() { $t.addClass('bpw-toast-show'); }, 10);
    setTimeout(function() { $t.removeClass('bpw-toast-show'); setTimeout(function() { $t.remove(); }, 300); }, 3000);
  }

  // Exports — State & Navigation
  window._bpwState = W;
  window._bpwGoStep = goStep;
  window._bpwGoNext = goNext;
  window._bpwGoPrev = goPrev;
  window._bpwSkipStep = skipStep;
  window._bpwRender = render;
  window._bpwToast = toast;
  window._bpwBuildSteps = buildSteps;
  window._bpwDrupalSave = drupalSave;
  // Exports — AI
  window._bpwLLMService = LLMService;
  window._bpwBuildAIContext = buildAIContext;
  window._bpwGetLangInstruction = getLangInstruction;
  window._bpwParseAIResponse = parseAIResponse;
  window._bpwSetSectionState = setSectionState;
  window._bpwAcceptSection = acceptSection;
  window._bpwRejectSection = rejectSection;
  window._bpwRenderAISection = renderAISection;
  // Exports — Save
  window._bpwAutoSave = autoSave;
  window._bpwSyncToTextarea = syncToTextarea;
  window._bpwBuildFinalProfile = buildFinalProfile;
  window._bpwSaveProgress = saveProgress;
  window._bpwSyncAllExportFields = syncAllExportFields;
  window._bpwBuildV2ExportContext = buildV2ExportContext;
  window._bpwCollectCurrentStepFields = _collectCurrentStepFields;
  // Exports — Utilities
  window._bpwEsc = esc;
  window._bpwIcon = icon;
  window._bpwGenerateId = generateId;
  window._bpwDeepClone = deepClone;
  window._bpwHas = has;
  window._bpwIsLevel = isLevel;
  window._bpwIsLevelOrAbove = isLevelOrAbove;
  window._bpwTypeLabels = typeLabels;
  // Exports — Activity Log
  window._bpwLogActivity = logActivity;
  window._bpwFormatRelativeTime = formatRelativeTime;
  // Exports — Constants
  window._bpwConstants = {
    BRAND_TYPES: BRAND_TYPES, BRAND_SUBTYPES: BRAND_SUBTYPES,
    LANGUAGES: LANGUAGES, LANG_NAMES: LANG_NAMES,
    SOCIAL_PLATFORMS: SOCIAL_PLATFORMS, BRAND_ARCHETYPES: BRAND_ARCHETYPES,
    SECTION_STATES: SECTION_STATES
  };

  console.log(LOG_PREFIX, 'Part 1 loaded');

})(jQuery, Drupal);
