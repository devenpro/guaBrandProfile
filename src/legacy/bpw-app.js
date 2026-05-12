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

  // ============================================================
  // SECTION 1: CONSTANTS
  // ============================================================

  var SCHEMA_VERSION = '2.0';
  var APP_ID = 'bpwApp';
  var LOG_PREFIX = '[BPW]';

  var BRAND_TYPES = {
    commercial: { label: 'Commercial business', icon: 'building',  color: 'var(--bpw-primary)' },
    local:      { label: 'Local business',      icon: 'store',     color: 'var(--bpw-success)' },
    creator:    { label: 'Content creator',     icon: 'video',     color: 'var(--bpw-accent)' },
    nonprofit:  { label: 'Non-commercial',      icon: 'heart',     color: 'var(--bpw-warning)' }
  };

  var BRAND_SUBTYPES = {
    commercial: [
      { id: 'saas', label: 'SaaS / Software' }, { id: 'ecommerce', label: 'E-commerce / Retail' },
      { id: 'agency', label: 'Agency / Consultancy' }, { id: 'services', label: 'Professional Services' },
      { id: 'marketplace', label: 'Marketplace' }, { id: 'other', label: 'Other' }
    ],
    local: [
      { id: 'restaurant', label: 'Restaurant / F&B' }, { id: 'health', label: 'Health & Wellness' },
      { id: 'retail', label: 'Retail Store' }, { id: 'professional', label: 'Professional Practice' },
      { id: 'home', label: 'Home Services' }, { id: 'other', label: 'Other' }
    ],
    creator: [
      { id: 'youtube', label: 'YouTube Channel' }, { id: 'blog', label: 'Blog / Newsletter' },
      { id: 'podcast', label: 'Podcast' }, { id: 'social', label: 'Social Media Brand' },
      { id: 'multi', label: 'Multi-platform' }, { id: 'other', label: 'Other' }
    ],
    nonprofit: [
      { id: 'ngo', label: 'NGO / Nonprofit' }, { id: 'community', label: 'Community / Association' },
      { id: 'education', label: 'Educational Institution' }, { id: 'government', label: 'Government / Public' },
      { id: 'other', label: 'Other' }
    ]
  };

  var DETECTION_DOES = [
    { id: 'products', icon: 'box',       label: 'Sells products',             desc: 'Physical or digital products, e-commerce, retail' },
    { id: 'services', icon: 'handshake', label: 'Provides services',          desc: 'Consulting, agency, professional, health, legal' },
    { id: 'content',  icon: 'video',     label: 'Creates content',            desc: 'Videos, articles, podcasts, newsletters, social media' },
    { id: 'cause',    icon: 'heart',     label: 'Serves a cause / community', desc: 'Nonprofit, education, government, community org' }
  ];

  var DETECTION_WHERE = [
    { id: 'online',   icon: 'globe',            label: 'Online / digital only' },
    { id: 'physical', icon: 'location-dot',     label: 'Physical location(s)' },
    { id: 'both',     icon: 'arrows-left-right', label: 'Both online & physical' }
  ];

  var DETECTION_REVENUE = [
    { id: 'products',      icon: 'shopping-cart',      label: 'Product sales' },
    { id: 'services',      icon: 'briefcase',          label: 'Service fees' },
    { id: 'subscriptions', icon: 'rotate',             label: 'Subscriptions' },
    { id: 'ads',           icon: 'rectangle-ad',       label: 'Ads / sponsorships' },
    { id: 'courses',       icon: 'graduation-cap',     label: 'Courses / digital products' },
    { id: 'donations',     icon: 'hand-holding-heart', label: 'Donations / grants' },
    { id: 'none',          icon: 'ban',                label: 'Not monetized' }
  ];

  var LANGUAGES = [
    { code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' },
    { code: 'bn', label: 'Bengali' }, { code: 'ta', label: 'Tamil' },
    { code: 'mr', label: 'Marathi' }, { code: 'te', label: 'Telugu' },
    { code: 'kn', label: 'Kannada' }, { code: 'ml', label: 'Malayalam' },
    { code: 'gu', label: 'Gujarati' }
  ];

  var LANG_NAMES = {};
  for (var li = 0; li < LANGUAGES.length; li++) LANG_NAMES[LANGUAGES[li].code] = LANGUAGES[li].label;

  var SOCIAL_PLATFORMS = [
    { id: 'youtube',   label: 'YouTube',        icon: 'fa-brands fa-youtube' },
    { id: 'instagram', label: 'Instagram',      icon: 'fa-brands fa-instagram' },
    { id: 'linkedin',  label: 'LinkedIn',       icon: 'fa-brands fa-linkedin' },
    { id: 'twitter_x', label: 'Twitter / X',    icon: 'fa-brands fa-x-twitter' },
    { id: 'facebook',  label: 'Facebook',       icon: 'fa-brands fa-facebook' },
    { id: 'tiktok',    label: 'TikTok',         icon: 'fa-brands fa-tiktok' },
    { id: 'google_business', label: 'Google Business', icon: 'fa-brands fa-google' },
    { id: 'other',     label: 'Other',          icon: 'fa-solid fa-link' }
  ];

  var BRAND_ARCHETYPES = [
    'Creator', 'Sage', 'Hero', 'Explorer', 'Ruler', 'Caregiver',
    'Magician', 'Rebel', 'Lover', 'Jester', 'Everyperson', 'Innocent'
  ];

  var SECTION_STATES = {
    pending:   { label: 'Pending',    icon: 'circle',           color: 'var(--bpw-muted)' },
    loading:   { label: 'Generating', icon: 'spinner fa-spin',  color: 'var(--bpw-primary)' },
    generated: { label: 'Generated',  icon: 'sparkles',         color: 'var(--bpw-primary)' },
    editing:   { label: 'Editing',    icon: 'pen',              color: 'var(--bpw-warning)' },
    manual:    { label: 'Editing',    icon: 'pen-to-square',    color: 'var(--bpw-warning)' },
    accepted:  { label: 'Accepted',   icon: 'check-circle',     color: 'var(--bpw-success)' },
    rejected:  { label: 'Rejected',   icon: 'circle-xmark',     color: 'var(--bpw-error)' }
  };

  var LEVEL_ORDER = { 'new': 0, 'growing': 1, 'deep': 2 };

  // AI endpoints (same as existing app)
  var AI_ENDPOINTS = {
    'gemini':      'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
    'claude':      'https://api.anthropic.com/v1/messages',
    'openai':      'https://api.openai.com/v1/chat/completions',
    'grok':        'https://api.x.ai/v1/chat/completions',
    'groq':        'https://api.groq.com/openai/v1/chat/completions',
    'nvidia':      'https://integrate.api.nvidia.com/v1/chat/completions',
    'huggingface': 'https://router.huggingface.co/v1/chat/completions',
    'openrouter':  'https://openrouter.ai/api/v1/chat/completions'
  };

  var PROVIDER_ICONS = {
    gemini: 'sparkles', claude: 'bolt', openai: 'cube', grok: 'bolt',
    groq: 'bolt', nvidia: 'cube', huggingface: 'cube', openrouter: 'shuffle'
  };

  // ============================================================
  // SECTION 2: STATE OBJECT
  // ============================================================

  var W = {
    $textarea: null, $form: null, $submitBtn: null,
    brandLevel: '', brandTypes: [], brandSubtypes: {}, language: 'en',
    detection: { does: [], where: '', revenue: [] },
    steps: [], currentStepId: 'welcome', completedSteps: [], skippedSteps: [],
    seedContext: {}, importedAssets: {}, discoveryAnswers: {},
    generatedSections: {}, acceptedSections: {},
    sectionStates: {},
    data: {},
    aiProvider: '', aiModel: '',
    isAIProcessing: false,
    dirty: false, lastSaved: null, autoSaveTimer: null,
    initialized: false, _initializing: false, isResuming: false,
    _socialRows: 1,
    _identityPhase: 'initial',  // 'initial' | 'mission_options' | 'mission_selected' | 'full_generating' | 'full_complete'
    _audiencePhase: 'initial',  // 'initial' | 'audience_generated' | 'audience_accepted' | 'offerings_generated'
    activityLog: []
  };

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

  function getDefaultData() {
    return {
      meta: {
        schema_version: SCHEMA_VERSION,
        brand_level: '',
        brand_types: [],
        brand_subtypes: {},
        language: 'en',
        wizard_status: 'not_started',
        wizard_progress: { completed_steps: [], current_step: 'welcome', skipped_steps: [] },
        modules_enabled: [],
        detection_answers: { does: [], where: '', revenue: [] },
        created: '', last_modified: '',
        ai_provider_used: '', ai_model_used: ''
      },
      identity: {}, voice: {}, messaging: {}, audience: {}, offerings: {},
      ai_preferences: { default_provider: '', default_model: '', custom_instructions: '' }
    };
  }

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

  function render() {
    var $app = $('#' + APP_ID);
    if (!$app.length) return;

    var html = '';
    html += renderHeader();
    if (W.currentStepId !== 'welcome') html += renderProgress();

    // G8: AI processing banner
    if (W.isAIProcessing && W._aiProgress) {
      html += renderProcessingBanner();
    }

    html += '<div class="bpw-content">';
    html += '<div class="bpw-step-card">';

    var renderer = STEP_RENDERERS[W.currentStepId];
    if (renderer) {
      html += renderer();
    } else {
      html += '<div class="bpw-empty-state">' + icon('circle-exclamation') + ' Screen not found: ' + esc(W.currentStepId) + '</div>';
    }

    html += '</div></div>';

    // G24: Keyboard shortcut hints (non-welcome steps only)
    if (W.currentStepId !== 'welcome') {
      html += '<div class="bpw-kbd-hints">';
      html += '<span>' + icon('keyboard') + '</span>';
      html += '<span><kbd>Ctrl+S</kbd> Save</span>';
      html += '<span><kbd>Ctrl+Enter</kbd> Next</span>';
      html += '<span><kbd>Esc</kbd> Cancel edit</span>';
      html += '</div>';
    }

    $app.html(html);

    // G8: Toggle processing class for CSS-based button disabling
    $app.toggleClass('bpw-ai-processing', !!W.isAIProcessing);

    setupStepEvents(W.currentStepId);
  }

  function renderProcessingBanner() {
    var p = W._aiProgress || {};
    var pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
    var label = p.currentKey ? p.currentKey.replace(/_/g, ' ') : 'processing';
    var h = '<div class="bpw-processing-banner">';
    h += '<div class="bpw-proc-content">';
    h += '<span class="bpw-proc-spinner">' + icon('spinner fa-spin') + '</span>';
    h += '<span class="bpw-proc-text">AI is generating <strong>' + esc(label) + '</strong>';
    if (p.total > 1) h += ' (' + p.current + ' of ' + p.total + ')';
    h += '...</span>';
    h += '</div>';
    if (p.total > 1) {
      h += '<div class="bpw-proc-bar"><div class="bpw-proc-fill" style="width:' + pct + '%"></div></div>';
    }
    h += '</div>';
    return h;
  }

  function renderHeader() {
    var h = '<div class="bpw-header">';
    h += '<div class="bpw-header-logo">' + icon('bolt') + ' GoUltraAI</div>';
    h += '<div class="bpw-header-title">Brand Profile Wizard</div>';
    // Save progress button
    h += '<div class="bpw-header-save-group">';
    if (W.lastSaved) {
      h += '<span class="bpw-header-save-status">' + icon('check-circle') + ' ' + formatRelativeTime(W.lastSaved) + '</span>';
    }
    h += '<button class="bpw-btn bpw-btn-sm bpw-btn-outline" data-action="save-progress">' + icon('floppy-disk') + ' Save</button>';
    h += '</div>';
    // Activity Log & Settings buttons
    if (W.currentStepId !== 'welcome') {
      h += '<div class="bpw-header-tools">';
      h += '<button class="bpw-btn bpw-btn-ghost bpw-btn-sm" data-action="open-activity-log" title="Activity Log">' + icon('clock-rotate-left') + '</button>';
      h += '<button class="bpw-btn bpw-btn-ghost bpw-btn-sm" data-action="open-settings" title="Settings">' + icon('gear') + '</button>';
      h += '</div>';
    }
    if (W.currentStepId !== 'welcome' && LLMService.isConfigured()) {
      h += '<div class="bpw-header-ai">';
      h += '<label>AI:</label>';
      h += LLMService.renderPicker();
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderProgress() {
    var h = '<div class="bpw-progress">';
    var idx = stepIndex();
    var reviewReachable = _isReviewReachable();
    for (var i = 0; i < W.steps.length; i++) {
      var s = W.steps[i];
      var isDone = W.completedSteps.indexOf(s.id) !== -1;
      var isCur = i === idx;
      var isSkipped = W.skippedSteps.indexOf(s.id) !== -1;
      var isReachable = isDone || isCur || i < idx || (s.id === 'review' && reviewReachable);
      var cls = isDone ? 'done' : isCur ? 'cur' : isSkipped ? 'skipped' : isReachable ? 'reachable' : '';

      if (i > 0) h += '<div class="bpw-progress-line' + (i <= idx || isDone ? ' done' : '') + '"></div>';
      h += '<div class="bpw-progress-dot ' + cls + '" data-action="go-step" data-step="' + esc(s.id) + '"' + (!isReachable && !isCur ? ' data-locked="true"' : '') + '>';
      if (isDone) h += icon('check');
      else if (s.id === 'review' && reviewReachable) h += icon('flag-checkered');
      else h += (i + 1);
      h += '<span class="bpw-progress-label">' + esc(s.label) + '</span>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function _isReviewReachable() {
    // Review is reachable when user has completed basics + at least one AI step
    if (W.completedSteps.indexOf('basics') === -1) return false;
    var aiSteps = ['market', 'identity', 'identity_voice', 'voice', 'audience', 'audience_offerings', 'offerings', 'content'];
    for (var i = 0; i < aiSteps.length; i++) {
      if (W.completedSteps.indexOf(aiSteps[i]) !== -1) return true;
    }
    // Also reachable if profile is complete
    if (W.data.meta && W.data.meta.wizard_status === 'complete') return true;
    return false;
  }

  function renderStepHeader(title, desc) {
    var h = '<div class="bpw-step-header">';
    h += '<div class="bpw-step-num">Step ' + getStepNumber() + ' of ' + getTotalSteps() + '</div>';
    h += '<div class="bpw-step-title">' + esc(title) + '</div>';
    if (desc) h += '<div class="bpw-step-desc">' + desc + '</div>';
    h += '</div>';
    return h;
  }

  function renderActions(cfg) {
    cfg = cfg || {};
    var h = '<div class="bpw-actions">';
    if (cfg.back !== false) {
      h += '<button class="bpw-btn bpw-btn-outline" data-action="go-prev">' + icon('arrow-left') + ' ' + (cfg.backLabel || 'Back') + '</button>';
    } else {
      h += '<div></div>';
    }
    h += '<div class="bpw-actions-right">';
    if (cfg.showSkip) {
      h += '<button class="bpw-btn bpw-btn-ghost" data-action="skip-step">Skip ' + icon('forward') + '</button>';
    }
    if (cfg.showAI) {
      h += '<button class="bpw-btn bpw-btn-ai" data-action="run-ai">' + icon('wand-magic-sparkles') + ' Run AI Research</button>';
    }
    h += '<button class="bpw-btn bpw-btn-primary" data-action="go-next">' + (cfg.nextLabel || 'Next') + ' ' + icon('arrow-right') + '</button>';
    h += '</div></div>';
    return h;
  }

  function renderSectionLabel(text) {
    return '<div class="bpw-section-label">' + esc(text) + '</div>';
  }

  function renderDivider() {
    return '<hr class="bpw-divider">';
  }

  function condNote(text) {
    return '<div class="bpw-cond-note">' + icon('wand-magic-sparkles') + ' ' + text + '</div>';
  }

  function renderBulkActions(stepKey) {
    // Only show if at least one section has content
    var keys = [];
    if (window._bpwPart2A && window._bpwPart2A.getSectionKeysForStep) {
      keys = window._bpwPart2A.getSectionKeysForStep(stepKey);
    }
    var hasContent = false;
    for (var i = 0; i < keys.length; i++) {
      if (W.generatedSections[keys[i]] || W.acceptedSections[keys[i]]) { hasContent = true; break; }
    }
    if (!hasContent) return '';
    var h = '<div class="bpw-bulk-actions">';
    h += '<button class="bpw-btn bpw-btn-outline bpw-btn-sm" data-action="redo-all" data-step="' + esc(stepKey) + '">' + icon('rotate-right') + ' Redo all</button>';
    h += '<button class="bpw-btn bpw-btn-success bpw-btn-sm" data-action="accept-all" data-step="' + esc(stepKey) + '">' + icon('check') + ' Accept all</button>';
    h += '</div>';
    return h;
  }

  function renderFormGroup(label, inputHtml, hint, required) {
    var h = '<div class="bpw-form-group">';
    h += '<label class="bpw-label">' + esc(label);
    if (required) h += ' <span class="bpw-req">*</span>';
    h += '</label>';
    h += inputHtml;
    if (hint) h += '<div class="bpw-hint">' + icon('circle-info') + ' ' + hint + '</div>';
    h += '</div>';
    return h;
  }

  function renderInput(name, value, placeholder, type) {
    return '<input class="bpw-input" data-field="' + esc(name) + '" value="' + esc(value || '') + '" placeholder="' + esc(placeholder || '') + '" type="' + (type || 'text') + '">';
  }

  function renderTextarea(name, value, placeholder, minHeight) {
    return '<textarea class="bpw-textarea" data-field="' + esc(name) + '" placeholder="' + esc(placeholder || '') + '"' + (minHeight ? ' style="min-height:' + minHeight + 'px"' : '') + '>' + esc(value || '') + '</textarea>';
  }

  function renderSelect(name, value, options) {
    var h = '<select class="bpw-select" data-field="' + esc(name) + '">';
    for (var i = 0; i < options.length; i++) {
      var o = options[i];
      var id = typeof o === 'string' ? o : (o.id || o.code || o.value);
      var lbl = typeof o === 'string' ? o : (o.label || o.name || id);
      h += '<option value="' + esc(id) + '"' + (value === id ? ' selected' : '') + '>' + esc(lbl) + '</option>';
    }
    h += '</select>';
    return h;
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
  }

  var _debouncedSave = debounce(function() { syncToTextarea(); }, 1000);

  function autoSave() {
    W.dirty = true;
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

  // Helper: get social profiles for export
  function _exportSocialProfiles() {
    return (W.importedAssets.social_profiles || [])
      .filter(function(sp) { return sp && sp.url; })
      .map(function(sp) { return { platform: sp.platform || '', url: sp.url, handle: sp.handle || '' }; });
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
  // SECTION 11: SCREEN — WELCOME
  // ============================================================

  function renderWelcome() {
    var h = '';
    h += '<div class="bpw-welcome-center">';
    h += '<div class="bpw-welcome-icon">' + icon('wand-magic-sparkles') + '</div>';
    h += '<h1 class="bpw-welcome-title">Let\'s build your brand profile</h1>';
    h += '<p class="bpw-welcome-desc">We\'ll guide you step by step. AI does the heavy lifting.</p>';

    h += renderSectionLabel('Where is your brand right now?');
    h += '<div class="bpw-level-cards">';

    var levels = [
      { id: 'new',     icon: 'seedling',    label: 'New brand',       desc: 'Starting from scratch or an early idea. AI builds most of it for you.', meta: '~10 min', color: 'green' },
      { id: 'growing', icon: 'chart-line',   label: 'Growing brand',   desc: 'Have a brand, want to structure and improve it. Import your assets, AI enhances them.', meta: '~20 min', color: 'blue' },
      { id: 'deep',    icon: 'microscope',   label: 'Brand deep-dive', desc: 'Established brand needing deep analysis, market research, and full competitive strategy.', meta: '~35 min', color: 'purple' }
    ];

    for (var i = 0; i < levels.length; i++) {
      var lv = levels[i];
      var sel = W.brandLevel === lv.id;
      h += '<div class="bpw-level-card' + (sel ? ' selected ' + lv.color : '') + '" data-action="set-level" data-level="' + lv.id + '">';
      h += '<div class="bpw-level-icon">' + icon(lv.icon) + '</div>';
      h += '<div class="bpw-level-name">' + esc(lv.label) + '</div>';
      h += '<div class="bpw-level-desc">' + esc(lv.desc) + '</div>';
      h += '<div class="bpw-level-meta">' + icon('clock') + ' ' + lv.meta + '</div>';
      h += '</div>';
    }
    h += '</div>';

    h += renderSectionLabel('Profile language');
    h += '<div class="bpw-lang-row">';
    h += renderSelect('language', W.language, LANGUAGES);
    h += '<span class="bpw-hint">' + icon('circle-info') + ' Brand content will be generated in this language</span>';
    h += '</div>';

    h += '<div class="bpw-welcome-action">';
    h += '<button class="bpw-btn bpw-btn-primary bpw-btn-lg" data-action="go-next"' + (!W.brandLevel ? ' disabled' : '') + '>Begin ' + icon('arrow-right') + '</button>';
    h += '</div>';
    h += '</div>';
    return h;
  }

  // ============================================================
  // SECTION 12: SCREEN — BRAND TYPE DETECTION
  // ============================================================

  function renderDetect() {
    var h = '';
    h += renderStepHeader('Tell us about your brand', 'Answer a few quick questions. We\'ll auto-detect what kind of brand you have.');

    h += renderDivider();

    // Q1: What does your brand do?
    h += '<div class="bpw-form-group">';
    h += '<div class="bpw-detect-question">What does your brand do? <span class="bpw-hint-inline">(select all that apply)</span></div>';
    h += '<div class="bpw-detect-grid">';
    for (var i = 0; i < DETECTION_DOES.length; i++) {
      var d = DETECTION_DOES[i];
      var on = W.detection.does.indexOf(d.id) !== -1;
      h += '<div class="bpw-detect-tile' + (on ? ' on' : '') + '" data-action="toggle-does" data-id="' + d.id + '">';
      h += '<div class="bpw-dt-check">' + (on ? icon('check') : '') + '</div>';
      h += '<div class="bpw-dt-icon">' + icon(d.icon) + '</div>';
      h += '<div class="bpw-dt-name">' + esc(d.label) + '</div>';
      h += '<div class="bpw-dt-desc">' + esc(d.desc) + '</div>';
      h += '</div>';
    }
    h += '</div></div>';

    // Q2: Where does your brand operate? (conditional)
    if (W.detection.does.indexOf('products') !== -1 || W.detection.does.indexOf('services') !== -1) {
      h += '<div class="bpw-form-group">';
      h += '<div class="bpw-detect-question">Where does your brand operate?</div>';
      h += '<div class="bpw-detect-row">';
      for (var j = 0; j < DETECTION_WHERE.length; j++) {
        var w = DETECTION_WHERE[j];
        var wOn = W.detection.where === w.id;
        h += '<div class="bpw-detect-tile-sm' + (wOn ? ' on' : '') + '" data-action="set-where" data-id="' + w.id + '">';
        h += '<div class="bpw-dt-icon">' + icon(w.icon) + '</div>';
        h += '<div class="bpw-dt-name">' + esc(w.label) + '</div>';
        h += '</div>';
      }
      h += '</div></div>';
    }

    // Q3: Revenue model
    h += '<div class="bpw-form-group">';
    h += '<div class="bpw-detect-question">How does (or will) your brand generate revenue? <span class="bpw-hint-inline">(select all)</span></div>';
    h += '<div class="bpw-detect-chips">';
    for (var k = 0; k < DETECTION_REVENUE.length; k++) {
      var r = DETECTION_REVENUE[k];
      var rOn = W.detection.revenue.indexOf(r.id) !== -1;
      h += '<div class="bpw-detect-chip' + (rOn ? ' on' : '') + '" data-action="toggle-revenue" data-id="' + r.id + '">';
      h += icon(r.icon) + ' ' + esc(r.label);
      h += '</div>';
    }
    h += '</div></div>';

    // Detection result
    var detected = detectTypes();
    if (detected.length && W.detection.does.length) {
      h += '<div class="bpw-detect-result">';
      h += '<div class="bpw-detect-result-title">' + icon('sparkles') + ' We detected your brand as:</div>';
      h += '<div class="bpw-detect-tags">';
      for (var m = 0; m < detected.length; m++) {
        var bt = BRAND_TYPES[detected[m]];
        h += '<span class="bpw-detect-tag">' + icon(bt.icon) + ' ' + esc(bt.label) + '</span>';
      }
      h += '</div>';

      var previewSteps = buildSteps();
      h += '<div class="bpw-detect-journey"><strong>Your personalized journey: ' + previewSteps.length + ' steps</strong></div>';
      h += '<div class="bpw-step-preview">';
      for (var n = 0; n < previewSteps.length; n++) {
        h += '<span class="bpw-sp-chip">' + icon(previewSteps[n].icon) + ' ' + esc(previewSteps[n].label) + '</span>';
      }
      h += '</div>';
      h += '<div class="bpw-detect-edit" data-action="edit-types">' + icon('pen') + ' Adjust brand types</div>';
      h += '</div>';
    }

    h += renderActions({ backLabel: 'Level', nextLabel: 'Confirm & continue' });
    return h;
  }

  // ============================================================
  // SECTION 13: SCREEN — BRAND BASICS
  // ============================================================

  function renderBasics() {
    var sc = W.seedContext;
    var h = '';
    h += renderStepHeader('Brand basics', 'The essentials. Everything here shapes your entire profile.');
    h += condNote('Showing fields relevant to: ' + typeLabels());

    // Core fields
    h += renderSectionLabel('Core info');
    h += renderFormGroup('Brand name', renderInput('name', sc.name, 'Your brand name'), null, true);
    h += renderFormGroup('Describe your brand in 2-3 sentences', renderTextarea('description', sc.description, 'What does your brand do? Who is it for?', 80), null, true);

    // Type-specific fields
    if (has('commercial') || has('local')) {
      h += '<div class="bpw-form-row">';
      h += renderFormGroup('Industry', renderInput('industry', sc.industry, 'e.g., Digital Marketing, Healthcare...'));
      h += renderFormGroup('Business model', renderSelect('business_model', sc.business_model || '', [
        { id: '', label: 'Select...' }, { id: 'b2b', label: 'B2B' }, { id: 'b2c', label: 'B2C' }, { id: 'both', label: 'Both B2B & B2C' }
      ]));
      h += '</div>';
    }

    if (has('local')) {
      h += '<div class="bpw-form-row">';
      h += renderFormGroup('City / service area', renderInput('service_area', sc.service_area, 'e.g., Kolkata, West Bengal'));
      h += renderFormGroup('Service category', renderInput('service_category', sc.service_category, 'e.g., Restaurant, Clinic, Salon...'));
      h += '</div>';
    }

    if (has('creator')) {
      h += '<div class="bpw-form-row">';
      h += renderFormGroup('Primary platform', renderSelect('primary_platform', sc.primary_platform || '', [
        { id: '', label: 'Select...' }, { id: 'youtube', label: 'YouTube' }, { id: 'blog', label: 'Blog / Newsletter' },
        { id: 'podcast', label: 'Podcast' }, { id: 'instagram', label: 'Instagram / TikTok' }, { id: 'multi', label: 'Multiple platforms' }
      ]));
      h += renderFormGroup('Content niche', renderInput('content_niche', sc.content_niche, 'e.g., Tech reviews, cooking, education...'));
      h += '</div>';
    }

    if (has('nonprofit')) {
      h += '<div class="bpw-form-row">';
      h += renderFormGroup('Cause area', renderInput('cause_area', sc.cause_area, 'e.g., Education, Environment, Health...'));
      h += renderFormGroup('Organization type', renderSelect('organization_type', sc.organization_type || '', [
        { id: '', label: 'Select...' }, { id: 'ngo', label: 'NGO / Nonprofit' }, { id: 'community', label: 'Community group' },
        { id: 'education', label: 'Educational institution' }, { id: 'government', label: 'Government / Public' }
      ]));
      h += '</div>';
    }

    // Online presence
    h += renderDivider();
    h += renderSectionLabel('Online presence' + (isLevel('new') ? ' (optional)' : ''));
    h += renderFormGroup('Website URL', renderInput('website_url', sc.website_url, 'https://...'),
      isLevelOrAbove('growing') ? 'We\'ll scrape and analyze this in the next step' : null);

    if (has('creator')) {
      h += renderFormGroup('Primary content channel URL', renderInput('channel_url', sc.channel_url, 'e.g., https://youtube.com/@YourChannel'),
        'We\'ll analyze your channel to understand your content');
    }

    // AI setup
    h += renderDivider();
    h += renderSectionLabel('AI setup');
    h += '<div class="bpw-form-row">';
    h += renderFormGroup('AI provider', LLMService.renderProviderSelect());
    h += renderFormGroup('Model', LLMService.renderModelSelect());
    h += '</div>';
    h += '<div class="bpw-hint">' + icon('circle-info') + ' Used for all AI research and content generation. Change anytime from the header.</div>';

    h += renderActions({});
    return h;
  }

  // ============================================================
  // SECTION 14: SCREEN — ASSETS IMPORT
  // ============================================================

  function renderImport() {
    var h = '';
    h += renderStepHeader('Import your brand assets', 'Give us what you have. AI will analyze and extract brand information.');
    h += condNote('Showing import options relevant to your brand types');

    // Website
    h += renderSectionLabel('Website');
    var webUrl = W.seedContext.website_url || '';
    h += '<div class="bpw-import-url-row">';
    h += '<input class="bpw-input" data-field="import-website-url" value="' + esc(webUrl) + '" placeholder="https://...">';
    h += '<button class="bpw-btn bpw-btn-ai bpw-btn-sm" data-action="scrape-url" data-type="website">' + icon('magnifying-glass') + ' Scrape & analyze</button>';
    h += '</div>';

    // Scraped result
    var webAsset = W.importedAssets.website;
    if (webAsset && webAsset.status === 'success') {
      h += renderScrapeCard(webAsset);
    } else if (webAsset && webAsset.status === 'loading') {
      h += renderScrapeLoading('Analyzing website...');
    }

    // Social profiles
    h += renderSectionLabel('Social media profiles');

    // Summary banner for detected profiles
    var detectedCount = 0;
    var socialProfiles = W.importedAssets.social_profiles || [];
    for (var dc = 0; dc < socialProfiles.length; dc++) {
      if (socialProfiles[dc] && socialProfiles[dc].status === 'detected') detectedCount++;
    }
    if (detectedCount > 0) {
      h += '<div class="bpw-social-summary">' + icon('wand-magic-sparkles') + ' Found ' + detectedCount + ' social profile' + (detectedCount > 1 ? 's' : '') + ' from your website. You can scrape each for detailed analysis.</div>';
    }

    var socialCount = Math.max(W._socialRows || 1, socialProfiles.length, 1);
    for (var i = 0; i < socialCount; i++) {
      var sp = socialProfiles[i] || {};
      h += '<div class="bpw-social-row' + (sp.status === 'detected' ? ' bpw-social-detected-row' : '') + '">';
      h += '<select class="bpw-select bpw-select-sm" data-field="social-platform-' + i + '">';
      for (var j = 0; j < SOCIAL_PLATFORMS.length; j++) {
        var pl = SOCIAL_PLATFORMS[j];
        h += '<option value="' + esc(pl.id) + '"' + (sp.platform === pl.id ? ' selected' : '') + '>' + esc(pl.label) + '</option>';
      }
      h += '</select>';
      h += '<input class="bpw-input bpw-input-sm" data-field="social-url-' + i + '" value="' + esc(sp.url || '') + '" placeholder="Profile URL...">';
      h += '<button class="bpw-btn bpw-btn-outline bpw-btn-sm" data-action="scrape-social" data-index="' + i + '">' + icon('magnifying-glass') + '</button>';
      if (sp.status === 'detected') {
        h += '<span class="bpw-social-detected-badge">' + icon('globe') + ' Detected</span>';
      }
      h += '</div>';
      if (sp.status === 'success' && sp.extracted) {
        h += '<div class="bpw-scrape-mini">' + icon('check-circle') + ' Analyzed: ' + esc(Object.keys(sp.extracted).length) + ' data points extracted</div>';
      } else if (sp.status === 'loading') {
        h += '<div class="bpw-scrape-mini">' + icon('spinner fa-spin') + ' Analyzing...</div>';
      }
    }
    h += '<div class="bpw-add-row" data-action="add-social-row">' + icon('plus') + ' Add another profile</div>';

    // Paste documents
    h += renderSectionLabel('Paste existing brand docs');
    h += renderTextarea('pasted_documents', W.importedAssets.pasted_documents || '', 'Paste brand guidelines, strategy docs, competitive research, anything relevant...', 100);
    h += '<div class="bpw-hint-row">';
    h += '<span class="bpw-hint">' + icon('circle-info') + ' Everything stays private in your profile</span>';
    h += '<span class="bpw-hint bpw-hint-right">' + ((W.importedAssets.pasted_documents || '').length) + ' / 50,000 chars</span>';
    h += '</div>';

    h += renderActions({ showSkip: true });
    return h;
  }

  function renderScrapeCard(asset) {
    var ext = asset.extracted || {};
    var h = '<div class="bpw-scrape-card">';
    h += '<div class="bpw-scrape-header">';
    h += '<div class="bpw-scrape-icon">' + icon('globe') + '</div>';
    h += '<div class="bpw-scrape-meta">';
    h += '<div class="bpw-scrape-url">' + esc(asset.url || '') + '</div>';
    h += '<div class="bpw-scrape-status">' + icon('check-circle') + ' Analyzed</div>';
    h += '</div>';
    h += '<div class="bpw-scrape-controls">';
    h += '<button class="bpw-section-btn accept" data-action="accept-scrape">' + icon('check') + ' Accept</button>';
    h += '<button class="bpw-section-btn" data-action="dismiss-scrape">' + icon('xmark') + '</button>';
    h += '</div></div>';

    h += '<div class="bpw-scrape-body">';
    if (ext.tagline) h += '<div><strong>Tagline:</strong> ' + esc(ext.tagline) + '</div>';
    if (ext.offerings && ext.offerings.length) {
      h += '<div><strong>Offerings:</strong></div><div class="bpw-chip-list">';
      for (var i = 0; i < ext.offerings.length; i++) h += '<span class="bpw-chip">' + esc(ext.offerings[i]) + '</span>';
      h += '</div>';
    }
    if (ext.target_audience) h += '<div><strong>Audience:</strong> ' + esc(ext.target_audience) + '</div>';
    if (ext.tone_detected) h += '<div><strong>Tone:</strong> ' + esc(ext.tone_detected) + '</div>';

    // Detected social profiles from website
    if (ext.social_profiles && ext.social_profiles.length) {
      h += '<div class="bpw-scrape-social-section">';
      h += '<div><strong>' + icon('share-nodes') + ' Social profiles found:</strong></div>';
      h += '<div class="bpw-scrape-social-list">';
      for (var s = 0; s < ext.social_profiles.length; s++) {
        var sp = ext.social_profiles[s];
        var plat = (sp.platform || 'other').toLowerCase().replace(/[\s\/]/g, '_');
        if (plat === 'twitter' || plat === 'x') plat = 'twitter_x';
        var platObj = null;
        for (var p = 0; p < SOCIAL_PLATFORMS.length; p++) {
          if (SOCIAL_PLATFORMS[p].id === plat) { platObj = SOCIAL_PLATFORMS[p]; break; }
        }
        if (!platObj) platObj = SOCIAL_PLATFORMS[SOCIAL_PLATFORMS.length - 1]; // 'other'
        h += '<div class="bpw-scrape-social-item">';
        h += '<span class="bpw-scrape-social-icon"><i class="' + platObj.icon + '"></i></span>';
        h += '<span class="bpw-scrape-social-name">' + esc(platObj.label) + '</span>';
        if (sp.handle) h += '<span class="bpw-scrape-social-handle">' + esc(sp.handle) + '</span>';
        h += '</div>';
      }
      h += '</div></div>';
    }

    h += '</div></div>';
    return h;
  }

  function renderScrapeLoading(msg) {
    return '<div class="bpw-scrape-loading"><div class="bpw-skeleton" style="height:16px;width:70%;margin-bottom:8px"></div><div class="bpw-skeleton" style="height:12px;width:50%"></div><div class="bpw-scrape-loading-text">' + icon('spinner fa-spin') + ' ' + esc(msg) + '</div></div>';
  }

  // ============================================================
  // SECTION 15: SCREEN — AI DISCOVERY
  // ============================================================

  function renderDiscovery() {
    var h = '';
    h += renderStepHeader('Discovery questions', 'Help AI understand your brand better. Answer what you can \u2014 skip what you\'re unsure about.');
    h += condNote('Questions tailored for: ' + typeLabels() + ' (' + (W.brandLevel || 'standard') + ' level)');

    var questions = buildDiscoveryQuestions();
    var answers = W.discoveryAnswers || {};

    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var ans = answers[q.id] || {};
      h += '<div class="bpw-question">';
      h += '<div class="bpw-question-num">Question ' + (i + 1) + ' of ' + questions.length;
      h += ' <button class="bpw-section-btn" data-action="skip-question" data-id="' + esc(q.id) + '">' + icon('forward') + ' Skip</button>';
      h += '</div>';
      h += '<div class="bpw-question-text">' + esc(q.text) + '</div>';
      if (q.why) h += '<div class="bpw-question-why">' + esc(q.why) + '</div>';

      if (q.type === 'radio' && q.options) {
        h += '<div class="bpw-radio-group">';
        for (var j = 0; j < q.options.length; j++) {
          var opt = q.options[j];
          var sel = ans.selected === j;
          h += '<div class="bpw-radio-option' + (sel ? ' selected' : '') + '" data-action="select-radio" data-qid="' + esc(q.id) + '" data-index="' + j + '">';
          h += '<div class="bpw-radio-dot"></div> ' + esc(opt);
          h += '</div>';
        }
        h += '</div>';
        if (q.allowDetail) {
          h += '<input class="bpw-input bpw-input-sm" data-field="discovery-detail-' + esc(q.id) + '" value="' + esc(ans.detail || '') + '" placeholder="Additional detail (optional)...">';
        }
      } else {
        h += '<textarea class="bpw-textarea" data-field="discovery-text-' + esc(q.id) + '" placeholder="' + esc(q.placeholder || 'Your answer...') + '">' + esc(ans.text || '') + '</textarea>';
      }
      h += '</div>';
    }

    h += renderActions({});
    return h;
  }

  function buildDiscoveryQuestions() {
    var qs = [];
    var qCount = isLevel('deep') ? 8 : isLevel('growing') ? 6 : 4;
    var qId = 0;

    // Universal
    qs.push({
      id: 'q' + (++qId), type: 'text',
      text: has('creator') ? 'What value does your content provide to your audience?' : has('nonprofit') ? 'What specific problem or gap does your organization address?' : 'What problem does your brand solve for customers?',
      why: 'Core value proposition',
      placeholder: has('creator') ? 'What do viewers/readers gain from your content?' : 'Describe the core problem...'
    });

    // Customer/Audience
    if (has('commercial') || has('local')) {
      qs.push({
        id: 'q' + (++qId), type: 'radio',
        text: 'Who is your primary customer?',
        why: 'Audience targeting and messaging tone',
        options: ['Solo individuals / consumers', 'Small teams (2-10 people)', 'Mid-size companies (10-100)', 'Large enterprises / agencies', 'Multiple segments'],
        allowDetail: true
      });
    }
    if (has('creator')) {
      qs.push({
        id: 'q' + (++qId), type: 'radio',
        text: 'What content format is your primary focus?',
        why: 'Content strategy and channel planning',
        options: ['Long-form video (YouTube, courses)', 'Short-form video (Reels, Shorts, TikTok)', 'Written (blog, newsletter)', 'Audio (podcast)', 'Mixed formats']
      });
    }
    if (has('nonprofit')) {
      qs.push({
        id: 'q' + (++qId), type: 'text',
        text: 'Who are your primary beneficiaries?',
        why: 'Mission targeting and impact measurement',
        placeholder: 'Describe who benefits from your work...'
      });
    }

    // Revenue / pricing
    if (has('commercial')) {
      qs.push({
        id: 'q' + (++qId), type: 'radio',
        text: 'What\'s your pricing approach?',
        why: 'Revenue model and positioning',
        options: ['Free / open source', 'Freemium', 'Subscription', 'One-time purchase', 'Custom / contact sales', 'Not decided yet']
      });
    }
    if (has('local')) {
      qs.push({
        id: 'q' + (++qId), type: 'radio',
        text: 'What\'s your typical price range?',
        why: 'Market positioning',
        options: ['Budget-friendly', 'Mid-range', 'Premium', 'Luxury']
      });
    }
    if (has('creator')) {
      qs.push({
        id: 'q' + (++qId), type: 'radio',
        text: 'How do you (or plan to) monetize your content?',
        why: 'Revenue streams and sustainability',
        options: ['Ad revenue (YouTube, display ads)', 'Sponsorships & brand deals', 'Courses / digital products', 'Merchandise', 'Memberships / Patreon', 'Not monetized yet']
      });
    }
    if (has('nonprofit')) {
      qs.push({
        id: 'q' + (++qId), type: 'radio',
        text: 'How is your organization funded?',
        why: 'Sustainability and donor communication',
        options: ['Individual donations', 'Corporate sponsorship / CSR', 'Government grants', 'Fee-for-service', 'Mixed funding sources']
      });
    }

    // Competitors / alternatives
    qs.push({
      id: 'q' + (++qId), type: 'text',
      text: has('creator') ? 'Who else covers your niche that you admire or compete with?' : has('nonprofit') ? 'What other organizations serve a similar cause in your area?' : 'Name 1-3 competitors or alternatives your customers consider',
      why: 'Competitive context',
      placeholder: 'Names or URLs...'
    });

    // Uniqueness
    qs.push({
      id: 'q' + (++qId), type: 'text',
      text: has('creator') ? 'What\'s your unique angle or perspective that sets you apart?' : 'What makes your brand different from alternatives?',
      why: 'Key differentiator for positioning',
      placeholder: 'What\'s unique about you...'
    });

    // Deep-dive extras
    if (isLevelOrAbove('growing')) {
      qs.push({
        id: 'q' + (++qId), type: 'text',
        text: 'What tone or personality should your brand convey?',
        why: 'Voice and communication style',
        placeholder: 'e.g., Professional but friendly, Bold and direct, Warm and supportive...'
      });
    }

    if (isLevel('deep')) {
      qs.push({
        id: 'q' + (++qId), type: 'text',
        text: 'What are your top 3 goals for the next 12 months?',
        why: 'Strategic direction for all content and positioning',
        placeholder: 'e.g., Launch product, grow to 10K subscribers, expand to new market...'
      });
    }

    return qs.slice(0, qCount);
  }

  // ============================================================
  // SECTION 16: SCREEN — MARKET RESEARCH
  // ============================================================

  function renderMarket() {
    var isDeep = isLevel('deep');
    var h = '';
    h += renderStepHeader('Market research' + (isDeep ? ' (deep analysis)' : ''), 'AI analyzes your competitive landscape and finds positioning opportunities.');
    if (has('local')) h += condNote('Including local market analysis for your service area');

    // User input
    h += renderSectionLabel('Your input (optional)');
    h += '<div class="bpw-form-group">';
    h += '<label class="bpw-label">Competitors you know about</label>';
    var knownComps = W.seedContext._knownCompetitors || [];
    for (var i = 0; i < knownComps.length; i++) {
      h += '<div class="bpw-inline-row">';
      h += '<input class="bpw-input bpw-input-sm" data-field="known-comp-' + i + '" value="' + esc(knownComps[i]) + '">';
      h += '<button class="bpw-section-btn" data-action="remove-comp" data-index="' + i + '">' + icon('xmark') + '</button>';
      h += '</div>';
    }
    h += '<div class="bpw-add-row" data-action="add-comp">' + icon('plus') + ' Add competitor</div>';
    h += '</div>';

    h += renderFormGroup('Research focus (optional)', renderInput('research_focus', '', 'e.g., Focus on AI marketing tools in Indian market'));

    var mktHasData = W.generatedSections.market_category || W.generatedSections.market_positioning;
    h += '<div class="bpw-ai-trigger-row"><button class="bpw-btn bpw-btn-ai" data-action="run-ai" data-step="market">' + icon('wand-magic-sparkles') + ' ' + (mktHasData ? 'Re-run' : 'Run') + ' AI Research</button></div>';

    // AI output sections
    var gen = W.generatedSections;
    if (gen.market_category || gen.market_positioning || gen.market_competitors) {
      h += renderDivider();
      h += renderSectionLabel('AI output');
      h += renderAISection('market_category', 'Market category', gen.market_category);
      h += renderAISection('market_positioning', 'Positioning statement', gen.market_positioning);
      h += renderAISection('market_competitors', 'Competitors', _renderCompetitorsList(gen.market_competitors));
      h += renderAISection('market_differentiators', 'Key differentiators', gen.market_differentiators);

      if (isDeep) {
        h += renderAISection('market_trends', 'Market trends', gen.market_trends);
        h += renderAISection('market_opportunities', 'Opportunities', gen.market_opportunities);
      }

      h += '<div class="bpw-bulk-actions">';
      h += '<button class="bpw-btn bpw-btn-outline" data-action="redo-all" data-step="market">' + icon('rotate-right') + ' Redo all</button>';
      h += '<button class="bpw-btn bpw-btn-success" data-action="accept-all" data-step="market">' + icon('check') + ' Accept all & continue</button>';
      h += '</div>';
    }

    h += renderActions({ showSkip: true });
    return h;
  }

  function _renderCompetitorsList(data) {
    if (!data) return '';
    if (typeof data === 'string') return esc(data);
    if (Array.isArray(data)) {
      var h = '';
      for (var i = 0; i < data.length; i++) {
        var c = data[i] || {};
        h += '<div class="bpw-competitor-card">';
        h += '<div class="bpw-comp-name">' + esc(c.name || '') + '</div>';
        if (c.description) h += '<div class="bpw-comp-desc">' + esc(c.description) + '</div>';
        h += '<div class="bpw-comp-row">';
        if (c.strengths && c.strengths.length) h += '<div><div class="bpw-comp-label">Strengths</div><div class="bpw-comp-good">' + c.strengths.map(esc).join(', ') + '</div></div>';
        if (c.weaknesses && c.weaknesses.length) h += '<div><div class="bpw-comp-label">Weaknesses</div><div class="bpw-comp-bad">' + c.weaknesses.map(esc).join(', ') + '</div></div>';
        h += '</div></div>';
      }
      h += '<div class="bpw-add-row" data-action="add-comp-manual">' + icon('plus') + ' Add competitor manually</div>';
      return h;
    }
    return esc(JSON.stringify(data));
  }

  // ============================================================
  // SECTION 17: SCREEN — IDENTITY (+ merged voice option)
  // ============================================================

  function renderIdentity(merged) {
    var h = '';
    var title = merged ? 'Identity & voice' : 'Brand identity';
    var desc = merged ? 'AI crafts your brand\'s identity, tone, and messaging.' : 'AI crafts your brand\'s core identity elements.';
    h += renderStepHeader(title, desc);
    h += condNote('Generated based on your ' + (has('creator') ? 'content niche and audience' : 'business type and market position'));

    var gen = W.generatedSections;
    var phase = W._identityPhase;
    var idStepKey = merged ? 'identity_voice' : 'identity';

    // === PHASE: INITIAL — show "Generate Mission Options" button ===
    if (phase === 'initial') {
      h += renderSectionLabel('Step 1: Mission statement');
      h += '<div class="bpw-phase-prompt">';
      h += '<p>Start by generating mission statement options. You\'ll pick one, then AI will build the rest of your identity around it.</p>';
      h += '<button class="bpw-btn bpw-btn-ai" data-action="run-ai" data-step="' + idStepKey + '">' + icon('wand-magic-sparkles') + ' Generate Mission Options</button>';
      h += '</div>';

      // Locked sections preview
      h += '<div class="bpw-locked-section">';
      h += '<div class="bpw-locked-icon">' + icon('lock') + '</div>';
      h += '<div class="bpw-locked-text">Vision, Core Values, Archetype & Elevator Pitch will generate after you pick a mission.</div>';
      h += '</div>';

      if (merged) {
        h += '<div class="bpw-locked-section">';
        h += '<div class="bpw-locked-icon">' + icon('lock') + '</div>';
        h += '<div class="bpw-locked-text">Voice & Messaging will unlock after identity is complete.</div>';
        h += '</div>';
      }
    }

    // === PHASE: MISSION_OPTIONS — show mission picker, rest locked ===
    if (phase === 'mission_options') {
      h += renderSectionLabel('Step 1: Choose your mission');
      h += renderAlternativePicker('identity_mission', 'Mission statement', gen.identity_mission_options, gen.identity_mission);

      h += '<div class="bpw-locked-section">';
      h += '<div class="bpw-locked-icon">' + icon('clock') + '</div>';
      h += '<div class="bpw-locked-text">Select a mission above — AI will then generate Vision, Values, Archetype & Pitch aligned with your choice.</div>';
      h += '</div>';

      if (merged) {
        h += '<div class="bpw-locked-section">';
        h += '<div class="bpw-locked-icon">' + icon('lock') + '</div>';
        h += '<div class="bpw-locked-text">Voice & Messaging will unlock after identity is complete.</div>';
        h += '</div>';
      }
    }

    // === PHASE: MISSION_SELECTED / FULL_GENERATING — show mission + loading skeletons ===
    if (phase === 'mission_selected' || phase === 'full_generating') {
      h += renderSectionLabel('Step 1: Mission statement');
      h += renderAlternativePicker('identity_mission', 'Mission statement', gen.identity_mission_options, gen.identity_mission);

      h += renderDivider();
      h += renderSectionLabel('Step 2: Identity elements');
      h += '<div class="bpw-phase-loading">';
      h += '<div class="bpw-skeleton" style="height:60px;margin-bottom:12px"></div>';
      h += '<div class="bpw-skeleton" style="height:80px;margin-bottom:12px"></div>';
      h += '<div class="bpw-skeleton" style="height:40px;margin-bottom:12px"></div>';
      h += '<div class="bpw-skeleton" style="height:60px"></div>';
      h += '<div class="bpw-phase-loading-text">' + icon('spinner fa-spin') + ' Generating identity elements based on your mission...</div>';
      h += '</div>';
    }

    // === PHASE: FULL_COMPLETE — show everything ===
    if (phase === 'full_complete') {
      h += renderSectionLabel('Mission statement');
      h += renderAlternativePicker('identity_mission', 'Mission statement', gen.identity_mission_options, gen.identity_mission);

      h += renderDivider();
      h += renderSectionLabel('Identity elements');

      // Vision
      h += renderAISection('identity_vision', 'Vision statement', gen.identity_vision);
      // Values
      h += renderAISection('identity_values', 'Core values', _renderValuesList(gen.identity_values));
      // Archetype
      h += renderAISection('identity_archetype', 'Brand archetype', gen.identity_archetype);
      // Elevator pitch
      h += renderAISection('identity_pitch', 'Elevator pitch', gen.identity_pitch);

      // Merged voice sections — only when identity is complete
      if (merged) {
        h += renderDivider();
        h += renderSectionLabel('Voice & messaging');
        if (gen.voice_tone || gen.voice_personality || gen.messaging_primary) {
          h += renderAISection('voice_tone', 'Primary tone', gen.voice_tone);
          h += renderAISection('voice_personality', 'Personality traits', _renderChipList(gen.voice_personality));
          h += renderAISection('messaging_primary', 'Key message', gen.messaging_primary);
        } else {
          h += '<div class="bpw-phase-prompt">';
          h += '<p>Identity is set. Now generate your brand voice and messaging.</p>';
          h += '<button class="bpw-btn bpw-btn-ai" data-action="run-ai" data-step="voice">' + icon('wand-magic-sparkles') + ' Generate Voice & Messaging</button>';
          h += '</div>';
        }
      }

      // Regenerate all button
      h += '<div class="bpw-ai-trigger-row"><button class="bpw-btn bpw-btn-outline bpw-btn-sm" data-action="run-ai-reset-identity" data-step="' + idStepKey + '">' + icon('arrow-rotate-left') + ' Regenerate All Identity</button></div>';
      h += renderBulkActions(idStepKey);
    }

    h += renderActions({ showSkip: true, nextLabel: 'Accept & continue' });
    return h;
  }

  function _renderValuesList(data) {
    if (!data) return '';
    if (typeof data === 'string') return esc(data);
    if (Array.isArray(data)) {
      var h = '<div class="bpw-values-list">';
      for (var i = 0; i < data.length; i++) {
        var v = data[i] || {};
        h += '<div class="bpw-value-item"><strong>' + esc(typeof v === 'string' ? v : v.value || '') + '</strong>';
        if (v.description) h += ' \u2014 ' + esc(v.description);
        h += '</div>';
      }
      h += '</div>';
      return h;
    }
    return esc(JSON.stringify(data));
  }

  function _renderChipList(data) {
    if (!data) return '';
    if (typeof data === 'string') return '<div class="bpw-chip-list"><span class="bpw-chip">' + esc(data) + '</span></div>';
    if (Array.isArray(data)) {
      var h = '<div class="bpw-chip-list">';
      for (var i = 0; i < data.length; i++) h += '<span class="bpw-chip">' + esc(data[i]) + '</span>';
      h += '</div>';
      return h;
    }
    return '';
  }

  // ============================================================
  // SECTION 18: SCREEN — VOICE & MESSAGING
  // ============================================================

  function renderVoice() {
    var h = '';
    h += renderStepHeader('Voice & messaging', 'How your brand sounds across every channel.');
    h += condNote('Voice calibrated for: ' + typeLabels());

    // Warn if identity not yet complete (standalone voice step — Deep level)
    if (W._identityPhase !== 'full_complete') {
      h += '<div class="bpw-locked-section">';
      h += '<div class="bpw-locked-icon">' + icon('circle-info') + '</div>';
      h += '<div class="bpw-locked-text">We recommend completing the Identity step first for best voice generation results. <a href="#" data-action="go-step" data-step="identity" style="color:var(--bpw-primary)">Go to Identity</a></div>';
      h += '</div>';
    }

    var gen = W.generatedSections;

    h += renderAISection('voice_tone', 'Primary tone', gen.voice_tone);
    h += renderAISection('voice_personality', 'Personality traits', _renderChipList(gen.voice_personality));
    h += renderAISection('voice_rules', 'Writing rules', _renderDosDonts(gen.voice_dos, gen.voice_donts));
    h += renderAISection('voice_vocabulary', 'Vocabulary', _renderVocabulary(gen.voice_preferred, gen.voice_avoided));
    h += renderAISection('messaging_primary', 'Primary message', gen.messaging_primary);
    h += renderAISection('messaging_supporting', 'Supporting messages', gen.messaging_supporting);
    h += renderAISection('messaging_headlines', 'Headlines', gen.messaging_headlines);

    // Voice preview
    if (gen.voice_sample) {
      h += '<div class="bpw-voice-preview">';
      h += '<div class="bpw-vp-label">' + icon('volume-high') + ' Voice preview \u2014 "Here\'s how your brand sounds"</div>';
      h += '<div class="bpw-vp-sample">' + esc(gen.voice_sample) + '</div>';
      h += '<div class="bpw-vp-try">';
      h += '<button class="bpw-section-btn" data-action="try-voice" data-format="tweet">' + icon('fa-brands fa-x-twitter') + ' Tweet</button>';
      h += '<button class="bpw-section-btn" data-action="try-voice" data-format="email">' + icon('envelope') + ' Email</button>';
      if (has('creator')) h += '<button class="bpw-section-btn" data-action="try-voice" data-format="video">' + icon('fa-brands fa-youtube') + ' Video script</button>';
      if (has('local')) h += '<button class="bpw-section-btn" data-action="try-voice" data-format="review">' + icon('star') + ' Review reply</button>';
      h += '<button class="bpw-section-btn" data-action="try-voice" data-format="custom">' + icon('pen') + ' Custom</button>';
      h += '</div></div>';
    }

    var voiceHasData = gen.voice_tone || gen.voice_dos;
    h += '<div class="bpw-ai-trigger-row"><button class="bpw-btn bpw-btn-ai" data-action="run-ai" data-step="voice">' + icon('wand-magic-sparkles') + ' ' + (voiceHasData ? 'Regenerate' : 'Generate') + ' Voice & Messaging</button></div>';
    h += renderBulkActions('voice');

    h += renderActions({ showSkip: true, nextLabel: 'Accept & continue' });
    return h;
  }

  function _renderDosDonts(dos, donts) {
    dos = dos || []; donts = donts || [];
    if (!dos.length && !donts.length) return '';
    var h = '<div class="bpw-dos-donts">';
    h += '<div class="bpw-dos"><div class="bpw-dd-label">' + icon('check') + ' Always do</div>';
    for (var i = 0; i < dos.length; i++) h += '<div class="bpw-dd-item">' + esc(typeof dos[i] === 'string' ? dos[i] : dos[i].text || '') + '</div>';
    h += '</div>';
    h += '<div class="bpw-donts"><div class="bpw-dd-label">' + icon('xmark') + ' Never do</div>';
    for (var j = 0; j < donts.length; j++) h += '<div class="bpw-dd-item">' + esc(typeof donts[j] === 'string' ? donts[j] : donts[j].text || '') + '</div>';
    h += '</div></div>';
    return h;
  }

  function _renderVocabulary(preferred, avoided) {
    preferred = preferred || []; avoided = avoided || [];
    if (!preferred.length && !avoided.length) return '';
    var h = '<div class="bpw-vocab">';
    if (preferred.length) {
      h += '<div class="bpw-vocab-section"><strong>Preferred terms:</strong> <div class="bpw-chip-list">';
      for (var i = 0; i < preferred.length; i++) h += '<span class="bpw-chip bpw-chip-success">' + esc(preferred[i]) + '</span>';
      h += '</div></div>';
    }
    if (avoided.length) {
      h += '<div class="bpw-vocab-section"><strong>Avoided terms:</strong> <div class="bpw-chip-list">';
      for (var j = 0; j < avoided.length; j++) h += '<span class="bpw-chip bpw-chip-error">' + esc(avoided[j]) + '</span>';
      h += '</div></div>';
    }
    h += '</div>';
    return h;
  }

  // ============================================================
  // SECTION 19: SCREEN — AUDIENCE (+ merged offerings option)
  // ============================================================

  function renderAudience(merged) {
    var h = '';
    var title = merged ? (has('creator') ? 'Audience & content' : has('nonprofit') ? 'Audience & programs' : 'Audience & offerings') : 'Audience & personas';
    h += renderStepHeader(title, 'Who your brand serves' + (merged ? ' and what you offer them' : '') + '.');
    h += condNote(has('creator') ? 'Audience analysis based on your content niche and platform' : 'Audience profiled from your business type and market');

    var gen = W.generatedSections;
    var phase = W._audiencePhase;
    var audStepKey = merged ? 'audience_offerings' : 'audience';

    // Check if audience sections are accepted
    var audienceAccepted = W.sectionStates.audience_primary === 'accepted' || W.sectionStates.audience_segments === 'accepted';

    // Update phase based on section states (auto-detect if sections were accepted)
    if (audienceAccepted && phase === 'audience_generated') {
      W._audiencePhase = 'audience_accepted';
      phase = 'audience_accepted';
    }

    // === AUDIENCE SECTION — always shown ===
    h += renderSectionLabel('Audience profile');

    if (phase === 'initial' && !gen.audience_primary && !gen.audience_segments) {
      // No data yet — show generate button
      h += '<div class="bpw-phase-prompt">';
      h += '<p>Generate your target audience profile. AI will create audience segments and ideal customer profiles.</p>';
      h += '<button class="bpw-btn bpw-btn-ai" data-action="run-ai" data-step="' + audStepKey + '">' + icon('wand-magic-sparkles') + ' Generate Audience Profile</button>';
      h += '</div>';
    } else {
      // Show audience sections
      h += renderAISection('audience_primary', 'Primary audience', gen.audience_primary);
      h += renderAISection('audience_segments', 'Audience segments', _renderSegments(gen.audience_segments));

      if (isLevelOrAbove('growing')) {
        h += renderAISection('audience_personas', 'Personas', _renderPersonas(gen.audience_personas));
      }

      // Regenerate audience button
      var audHasData = gen.audience_primary || gen.audience_segments;
      if (audHasData) {
        h += '<div class="bpw-ai-trigger-row"><button class="bpw-btn bpw-btn-outline bpw-btn-sm" data-action="run-ai" data-step="' + audStepKey + '">' + icon('arrow-rotate-left') + ' Regenerate Audience</button></div>';
      }
    }

    // === OFFERINGS SECTION — only for merged steps ===
    if (merged) {
      h += renderDivider();
      var offLabel = has('creator') ? 'Content & monetization' : has('nonprofit') ? 'Programs' : 'Offerings';
      h += renderSectionLabel(offLabel);

      var offeringsHaveData = gen.offerings_items || gen.offerings_content || gen.offerings_programs;

      if (!audienceAccepted && !offeringsHaveData) {
        // Audience not yet accepted — lock offerings
        h += '<div class="bpw-locked-section">';
        h += '<div class="bpw-locked-icon">' + icon('lock') + '</div>';
        h += '<div class="bpw-locked-text">Accept your audience profile above to unlock ' + offLabel.toLowerCase() + ' generation.</div>';
        h += '</div>';
      } else if (audienceAccepted && !offeringsHaveData) {
        // Audience accepted, no offerings yet — show generate button
        h += '<div class="bpw-phase-prompt">';
        h += '<p>Audience is set. Now generate your ' + offLabel.toLowerCase() + ' based on the audience profile.</p>';
        h += '<button class="bpw-btn bpw-btn-ai" data-action="run-ai-offerings-only">' + icon('wand-magic-sparkles') + ' Generate ' + offLabel + '</button>';
        h += '</div>';
      } else {
        // Show offerings sections
        if (has('creator')) {
          h += renderAISection('offerings_content', 'Content formats', gen.offerings_content);
          h += renderAISection('offerings_revenue', 'Revenue streams', gen.offerings_revenue);
        }
        if (has('commercial') || has('local')) {
          h += renderAISection('offerings_items', has('local') ? 'Services' : 'Products & services', _renderOfferingsList(gen.offerings_items));
        }
        if (has('nonprofit')) {
          h += renderAISection('offerings_programs', 'Programs & services', _renderOfferingsList(gen.offerings_programs));
        }

        // Regenerate offerings button
        h += '<div class="bpw-ai-trigger-row"><button class="bpw-btn bpw-btn-outline bpw-btn-sm" data-action="run-ai-offerings-only">' + icon('arrow-rotate-left') + ' Regenerate ' + offLabel + '</button></div>';
      }

      // Regenerate all button
      h += '<div class="bpw-ai-trigger-row"><button class="bpw-btn bpw-btn-outline bpw-btn-sm" data-action="run-ai-reset-audience" data-step="' + audStepKey + '">' + icon('arrow-rotate-left') + ' Regenerate All</button></div>';
      h += renderBulkActions(audStepKey);
    } else {
      // Standalone audience step — just audience, no offerings
      var audHasData2 = gen.audience_primary || gen.audience_segments;
      if (audHasData2) {
        h += renderBulkActions(audStepKey);
      }
    }

    h += renderActions({ showSkip: true, nextLabel: 'Accept & continue' });
    return h;
  }

  function _renderSegments(data) {
    if (!data || !Array.isArray(data)) return typeof data === 'string' ? esc(data) : '';
    var h = '';
    for (var i = 0; i < data.length; i++) {
      var s = data[i] || {};
      h += '<div class="bpw-segment">';
      h += '<strong>' + esc(s.name || '') + '</strong>';
      if (s.description) h += ' \u2014 ' + esc(s.description);
      if (s.pain_points && s.pain_points.length) {
        h += '<div class="bpw-chip-list" style="margin-top:4px">';
        for (var j = 0; j < s.pain_points.length; j++) h += '<span class="bpw-chip bpw-chip-error">' + esc(s.pain_points[j]) + '</span>';
        h += '</div>';
      }
      h += '</div>';
    }
    return h;
  }

  function _renderPersonas(data) {
    if (!data || !Array.isArray(data)) return typeof data === 'string' ? esc(data) : '';
    var h = '';
    for (var i = 0; i < data.length; i++) {
      var p = data[i] || {};
      var initials = (p.name || 'P').split(' ').map(function(w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase();
      h += '<div class="bpw-persona">';
      h += '<div class="bpw-persona-header">';
      h += '<div class="bpw-persona-avatar">' + initials + '</div>';
      h += '<div><div class="bpw-persona-name">' + esc(p.name || '') + '</div>';
      h += '<div class="bpw-persona-role">' + esc(p.role || '') + (p.age ? ', age ' + esc(p.age) : '') + '</div></div>';
      h += '</div>';
      if (p.story) h += '<div class="bpw-persona-story">' + esc(p.story) + '</div>';
      if (p.pain_points || p.goals) {
        h += '<div class="bpw-chip-list">';
        if (p.pain_points) for (var j = 0; j < p.pain_points.length; j++) h += '<span class="bpw-chip bpw-chip-error">Pain: ' + esc(p.pain_points[j]) + '</span>';
        if (p.goals) for (var k = 0; k < p.goals.length; k++) h += '<span class="bpw-chip bpw-chip-success">Goal: ' + esc(p.goals[k]) + '</span>';
        h += '</div>';
      }
      h += '</div>';
    }
    h += '<div class="bpw-add-row" data-action="add-persona">' + icon('plus') + ' Add persona manually</div>';
    return h;
  }

  // ============================================================
  // SECTION 20: SCREEN — OFFERINGS
  // ============================================================

  function renderOfferings() {
    var h = '';
    var label = _offeringsLabel();
    h += renderStepHeader(label, 'Detailed profiles of what your brand offers.');
    h += condNote('Structure adapted for your brand type');

    var gen = W.generatedSections;

    if (has('commercial') || has('local')) {
      h += renderAISection('offerings_items', has('local') ? 'Services' : 'Products & services', _renderOfferingsList(gen.offerings_items));
    }
    if (has('creator')) {
      h += renderAISection('offerings_content', 'Content library', gen.offerings_content);
      h += renderAISection('offerings_revenue', 'Revenue streams', gen.offerings_revenue);
    }
    if (has('nonprofit')) {
      h += renderAISection('offerings_programs', 'Programs & services', _renderOfferingsList(gen.offerings_programs));
    }
    if (has('commercial')) {
      h += renderAISection('offerings_pricing', 'Pricing model', gen.offerings_pricing);
    }

    var offHasData = gen.offerings_items || gen.offerings_content || gen.offerings_programs;
    h += '<div class="bpw-ai-trigger-row"><button class="bpw-btn bpw-btn-ai" data-action="run-ai" data-step="offerings">' + icon('wand-magic-sparkles') + ' ' + (offHasData ? 'Regenerate' : 'Generate') + ' Offerings</button></div>';
    h += renderBulkActions('offerings');

    h += renderActions({ showSkip: true, nextLabel: 'Accept & continue' });
    return h;
  }

  function _renderOfferingsList(data) {
    if (!data || !Array.isArray(data)) return typeof data === 'string' ? esc(data) : '';
    var h = '';
    for (var i = 0; i < data.length; i++) {
      var o = data[i] || {};
      h += '<div class="bpw-offering-card">';
      h += '<div class="bpw-off-name">' + esc(o.name || '') + '</div>';
      if (o.category) h += '<div class="bpw-off-cat">' + icon('cube') + ' ' + esc(o.category) + '</div>';
      if (o.description) h += '<div class="bpw-off-desc">' + esc(o.description) + '</div>';
      if (o.features && o.features.length) {
        h += '<div class="bpw-chip-list">';
        for (var j = 0; j < o.features.length; j++) h += '<span class="bpw-chip">' + esc(o.features[j]) + '</span>';
        h += '</div>';
      }
      h += '</div>';
    }
    h += '<div class="bpw-add-row" data-action="add-offering">' + icon('plus') + ' Add offering manually</div>';
    return h;
  }

  // ============================================================
  // SECTION 21: SCREEN — CONTENT & CHANNELS
  // ============================================================

  function renderContent() {
    var h = '';
    h += renderStepHeader(has('creator') ? 'Channels & strategy' : 'Content & channels', 'Where and how your brand publishes content.');
    h += condNote(has('creator') ? 'Strategy built around your content niche and platform' : 'Channel strategy aligned with your business and audience');

    var gen = W.generatedSections;

    h += renderAISection('content_pillars', 'Content pillars', _renderPillars(gen.content_pillars));
    h += renderAISection('content_channels', 'Channel strategy', gen.content_channels);
    h += renderAISection('content_seo', 'SEO keywords', _renderChipList(gen.content_seo));
    h += renderAISection('content_hashtags', 'Hashtags', _renderChipList(gen.content_hashtags));

    var cntHasData = gen.content_pillars || gen.content_channels;
    h += '<div class="bpw-ai-trigger-row"><button class="bpw-btn bpw-btn-ai" data-action="run-ai" data-step="content">' + icon('wand-magic-sparkles') + ' ' + (cntHasData ? 'Regenerate' : 'Generate') + ' Content Strategy</button></div>';
    h += renderBulkActions('content');

    h += renderActions({ showSkip: true, nextLabel: 'Accept & continue' });
    return h;
  }

  function _renderPillars(data) {
    if (!data || !Array.isArray(data)) return typeof data === 'string' ? esc(data) : '';
    var h = '';
    for (var i = 0; i < data.length; i++) {
      var p = data[i] || {};
      h += '<div class="bpw-pillar">';
      h += '<div class="bpw-pillar-name">' + esc(p.pillar || p.name || '') + '</div>';
      if (p.description) h += '<div class="bpw-pillar-desc">' + esc(p.description) + '</div>';
      if (p.topics && p.topics.length) {
        h += '<div class="bpw-chip-list">';
        for (var j = 0; j < p.topics.length; j++) h += '<span class="bpw-chip">' + esc(p.topics[j]) + '</span>';
        h += '</div>';
      }
      h += '</div>';
    }
    return h;
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

  function renderReview() {
    // Fix 4: Ensure all accepted flat keys are assembled into modules
    _ensureModulesAssembled();

    var h = '';
    h += '<div class="bpw-step-header">';
    h += '<div class="bpw-step-num">Final step</div>';
    h += '<div class="bpw-step-title">Review your brand profile</div>';
    h += '<div class="bpw-step-desc">Review each section below. Click Edit to navigate directly to that step.</div>';
    h += '</div>';

    var comp = calcDetailedCompleteness();
    var pct = comp.overall;
    h += '<div class="bpw-completeness">';
    h += '<span class="bpw-comp-label">Overall completeness</span>';
    h += '<div class="bpw-comp-bar"><div class="bpw-comp-fill" style="width:' + pct + '%;background:' + _pctColor(pct) + '"></div></div>';
    h += '<div class="bpw-comp-pct" style="color:' + _pctColor(pct) + '">' + pct + '%</div>';
    h += '</div>';

    var sections = buildReviewSections(comp);
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      var statusCls = s.pct >= 80 ? 'bpw-rv-complete' : s.pct > 0 ? 'bpw-rv-partial' : 'bpw-rv-empty';
      h += '<div class="bpw-review-card ' + statusCls + '">';
      h += '<div class="bpw-review-header" data-action="review-edit" data-section="' + esc(s.key) + '">';
      h += '<div class="bpw-review-title">';
      h += '<span class="bpw-rv-status-dot ' + statusCls + '"></span>';
      h += icon(s.icon) + ' ' + esc(s.name);
      h += '</div>';
      h += '<div class="bpw-review-right">';
      h += '<div class="bpw-review-bar"><div class="bpw-review-fill" style="width:' + s.pct + '%;background:' + _pctColor(s.pct) + '"></div></div>';
      h += '<span class="bpw-review-pct" style="color:' + _pctColor(s.pct) + '">' + s.pct + '%</span>';
      h += '<button class="bpw-section-btn" data-action="review-edit" data-section="' + esc(s.key) + '">' + icon('pen') + ' Edit</button>';
      h += '</div></div>';
      h += '<div class="bpw-review-body">';
      h += s.preview;
      // Show missing fields as guidance
      if (s.missing && s.missing.length > 0 && s.pct < 100) {
        h += '<div class="bpw-rv-missing">' + icon('circle-info') + ' Missing: ' + s.missing.join(', ') + '</div>';
      }
      h += '</div>';
      h += '</div>';
    }

    if (W.skippedSteps.length) {
      h += '<div class="bpw-warn-box">';
      h += icon('forward') + ' <strong>Skipped:</strong> ';
      h += W.skippedSteps.map(function(sid) { var st = stepById(sid); return st ? st.label : sid; }).join(', ');
      h += '</div>';
    }

    h += renderDivider();
    h += '<div class="bpw-review-actions">';
    h += '<button class="bpw-btn bpw-btn-success" data-action="complete-wizard">' + icon('check-circle') + ' Save & complete</button>';
    h += '<button class="bpw-btn bpw-btn-outline" data-action="export-json">' + icon('download') + ' Export JSON</button>';
    h += '</div>';
    h += '<div class="bpw-hint" style="text-align:center;margin-top:8px">' + icon('circle-info') + ' You can re-edit anytime by opening this profile again</div>';

    return h;
  }

  function _pctColor(pct) {
    if (pct >= 80) return 'var(--bpw-success)';
    if (pct > 0) return 'var(--bpw-warning)';
    return 'var(--bpw-text-muted)';
  }

  var REVIEW_STEP_MAP = {
    identity: { deep: 'identity', growing: 'identity_voice', 'new': 'identity_voice' },
    voice:    { deep: 'voice',    growing: 'identity_voice', 'new': 'identity_voice' },
    messaging:{ deep: 'voice',    growing: 'identity_voice', 'new': 'identity_voice' },
    audience: { deep: 'audience', growing: 'audience_offerings', 'new': 'audience_offerings' },
    offerings:{ deep: 'offerings',growing: 'audience_offerings', 'new': 'audience_offerings' },
    market:   { deep: 'market',   growing: 'market', 'new': 'market' },
    content_strategy: { deep: 'content', growing: 'content', 'new': 'content' }
  };

  function _getStepForSection(sectionKey) {
    if (stepById(sectionKey)) return sectionKey;
    var map = REVIEW_STEP_MAP[sectionKey];
    if (map) {
      var stepId = map[W.brandLevel] || map.growing || sectionKey;
      return stepById(stepId) ? stepId : null;
    }
    return null;
  }

  function calcDetailedCompleteness() {
    _mergeSeedIntoIdentity();
    var acc = W.acceptedSections || {};
    var modules = {};
    var missing = {};

    var checks = {
      identity:  { obj: acc.identity, fields: ['name', 'description', 'mission', 'vision', 'values', 'brand_archetype', 'elevator_pitch'], labels: { name: 'Brand name', description: 'Description', mission: 'Mission', vision: 'Vision', values: 'Core values', brand_archetype: 'Archetype', elevator_pitch: 'Elevator pitch' } },
      voice:     { obj: acc.voice,    fields: ['primary_tone', 'personality_traits', 'dos', 'donts'], labels: { primary_tone: 'Primary tone', personality_traits: 'Personality traits', dos: 'Do rules', donts: 'Don\'t rules' } },
      messaging: { obj: acc.messaging, fields: ['primary_message', 'supporting_messages'], labels: { primary_message: 'Primary message', supporting_messages: 'Supporting messages' } },
      audience:  { obj: acc.audience,  fields: ['primary_description', 'segments'], labels: { primary_description: 'Primary audience', segments: 'Segments' } },
      offerings: { obj: acc.offerings, fields: ['items'], labels: { items: 'Offerings list' } }
    };

    if (isLevelOrAbove('growing') && (has('commercial') || has('local'))) {
      checks.market = { obj: acc.market, fields: ['category', 'positioning', 'competitors', 'differentiators'], labels: { category: 'Category', positioning: 'Positioning', competitors: 'Competitors', differentiators: 'Differentiators' } };
    }
    if (has('creator') || (isLevel('deep') && has('commercial'))) {
      checks.content_strategy = { obj: acc.content_strategy, fields: ['pillars', 'channels', 'seo_keywords'], labels: { pillars: 'Pillars', channels: 'Channels', seo_keywords: 'SEO keywords' } };
    }

    var sum = 0, cnt = 0;
    for (var mod in checks) {
      if (!checks.hasOwnProperty(mod)) continue;
      var c = checks[mod];
      var result = _fieldScoreDetailed(c.obj, c.fields, c.labels);
      modules[mod] = result.pct;
      missing[mod] = result.missing;
      sum += result.pct;
      cnt++;
    }

    return { overall: cnt > 0 ? Math.round(sum / cnt) : 0, modules: modules, missing: missing };
  }

  function _fieldScoreDetailed(obj, fields, labels) {
    var filled = 0;
    var missingList = [];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var v = obj ? obj[f] : undefined;
      var isFilled = v !== undefined && v !== null && v !== '';
      if (isFilled && Array.isArray(v) && v.length === 0) isFilled = false;
      if (isFilled && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) isFilled = false;
      if (isFilled) {
        filled++;
      } else {
        missingList.push(labels[f] || f);
      }
    }
    return { pct: fields.length > 0 ? Math.round((filled / fields.length) * 100) : 0, missing: missingList };
  }

  function _fieldScore(obj, fields) { return _fieldScoreDetailed(obj, fields, {}).pct; }

  function calcCompleteness() { return calcDetailedCompleteness().overall; }

  function buildReviewSections(comp) {
    var sections = [];
    var acc = W.acceptedSections;
    var mods = comp ? comp.modules : {};
    var miss = comp ? comp.missing : {};
    sections.push({ key: 'identity', name: 'Identity', icon: 'fingerprint', pct: mods.identity || 0, missing: miss.identity || [], preview: _identityPreview(acc.identity) });
    sections.push({ key: 'voice', name: 'Voice', icon: 'volume-high', pct: mods.voice || 0, missing: miss.voice || [], preview: _voicePreview(acc.voice) });
    sections.push({ key: 'messaging', name: 'Messaging', icon: 'bullhorn', pct: mods.messaging || 0, missing: miss.messaging || [], preview: _messagingPreview(acc.messaging) });
    sections.push({ key: 'audience', name: 'Audience', icon: 'users', pct: mods.audience || 0, missing: miss.audience || [], preview: _audiencePreview(acc.audience) });
    if (has('commercial') || has('local') || has('nonprofit')) {
      sections.push({ key: 'offerings', name: _offeringsLabel(), icon: 'cube', pct: mods.offerings || 0, missing: miss.offerings || [], preview: _offeringsPreview(acc.offerings) });
    }
    if (isLevelOrAbove('growing') && (has('commercial') || has('local'))) {
      sections.push({ key: 'market', name: 'Market', icon: 'chart-bar', pct: mods.market || 0, missing: miss.market || [], preview: _marketPreview(acc.market) });
    }
    if (has('creator') || (isLevel('deep') && has('commercial'))) {
      sections.push({ key: 'content_strategy', name: 'Content & channels', icon: 'newspaper', pct: mods.content_strategy || 0, missing: miss.content_strategy || [], preview: _contentPreview(acc.content_strategy) });
    }
    return sections;
  }

  function _identityPreview(id) {
    if (!id || isEmpty(id)) return '<span class="bpw-muted">Not started \u2014 click Edit to begin</span>';
    var p = [];
    if (id.name) p.push('<strong>' + esc(id.name) + '</strong>');
    if (id.tagline) p.push('"' + esc(id.tagline) + '"');
    if (id.mission) p.push('Mission: ' + esc(truncate(id.mission, 50)));
    if (id.values && id.values.length) p.push(id.values.length + ' values');
    if (id.brand_archetype) p.push('Archetype: ' + esc(truncate(id.brand_archetype, 30)));
    return p.join(' \u00b7 ') || '<span class="bpw-muted">Incomplete</span>';
  }
  function _voicePreview(v) {
    if (!v || isEmpty(v)) return '<span class="bpw-muted">Not started \u2014 click Edit to begin</span>';
    var p = [];
    if (v.primary_tone) p.push('Tone: ' + esc(truncate(v.primary_tone, 40)));
    if (v.personality_traits && v.personality_traits.length) p.push(v.personality_traits.length + ' traits');
    if (v.dos && v.dos.length) p.push(v.dos.length + ' do rules');
    if (v.donts && v.donts.length) p.push(v.donts.length + ' don\'t rules');
    return p.join(' \u00b7 ') || '<span class="bpw-muted">Incomplete</span>';
  }
  function _messagingPreview(m) {
    if (!m || isEmpty(m)) return '<span class="bpw-muted">Not started \u2014 click Edit to begin</span>';
    var p = [];
    if (m.primary_message) p.push('"' + esc(truncate(m.primary_message, 50)) + '"');
    if (m.supporting_messages && m.supporting_messages.length) p.push(m.supporting_messages.length + ' supporting');
    if (m.headlines && m.headlines.length) p.push(m.headlines.length + ' headlines');
    return p.join(' \u00b7 ') || '<span class="bpw-muted">Incomplete</span>';
  }
  function _audiencePreview(a) {
    if (!a || isEmpty(a)) return '<span class="bpw-muted">Not started \u2014 click Edit to begin</span>';
    var p = [];
    if (a.primary_description) p.push(esc(truncate(a.primary_description, 60)));
    if (a.segments && a.segments.length) p.push(a.segments.length + ' segment(s)');
    if (a.personas && a.personas.length) p.push(a.personas.length + ' persona(s)');
    return p.join(' \u00b7 ') || '<span class="bpw-muted">Incomplete</span>';
  }
  function _offeringsPreview(o) {
    if (!o || isEmpty(o)) return '<span class="bpw-muted">Not started \u2014 click Edit to begin</span>';
    var p = [];
    if (o.items && o.items.length) p.push(o.items.length + ' offering(s)');
    if (o.pricing_model) p.push('Pricing: ' + esc(truncate(typeof o.pricing_model === 'string' ? o.pricing_model : '', 30)));
    return p.join(' \u00b7 ') || '<span class="bpw-muted">Incomplete</span>';
  }
  function _marketPreview(m) {
    if (!m || isEmpty(m)) return '<span class="bpw-muted">Not started \u2014 click Edit to begin</span>';
    var p = [];
    if (m.category) p.push(esc(truncate(m.category, 40)));
    if (m.competitors && m.competitors.length) p.push(m.competitors.length + ' competitor(s)');
    if (m.differentiators && m.differentiators.length) p.push(m.differentiators.length + ' differentiator(s)');
    return p.join(' \u00b7 ') || '<span class="bpw-muted">Incomplete</span>';
  }
  function _contentPreview(c) {
    if (!c || isEmpty(c)) return '<span class="bpw-muted">Not started \u2014 click Edit to begin</span>';
    var p = [];
    if (c.pillars && c.pillars.length) p.push(c.pillars.length + ' pillar(s)');
    if (c.channels && c.channels.length) p.push(c.channels.length + ' channel(s)');
    if (c.seo_keywords && c.seo_keywords.length) p.push(c.seo_keywords.length + ' keywords');
    if (c.hashtags && c.hashtags.length) p.push(c.hashtags.length + ' hashtags');
    return p.join(' \u00b7 ') || '<span class="bpw-muted">Incomplete</span>';
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
      W.isAIProcessing = true;

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
          W.isAIProcessing = false;
          if (onSuccess) onSuccess(txt);
        })
        .catch(function(err) {
          console.error(LOG_PREFIX, 'AI error:', err);
          W.isAIProcessing = false;
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

  var STEP_RENDERERS = {
    welcome: renderWelcome,
    detect: renderDetect,
    basics: renderBasics,
    'import': renderImport,
    discovery: renderDiscovery,
    market: renderMarket,
    identity: function() { return renderIdentity(false); },
    voice: renderVoice,
    audience: function() { return renderAudience(false); },
    offerings: renderOfferings,
    content: renderContent,
    review: renderReview,
    identity_voice: function() { return renderIdentity(true); },
    audience_offerings: function() { return renderAudience(true); }
  };

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

  function setupStepEvents(stepId) {
    switch (stepId) {
      case 'welcome': setupWelcomeEvents(); break;
      case 'detect': setupDetectEvents(); break;
      case 'basics': setupBasicsEvents(); break;
      case 'import': setupImportEvents(); break;
      case 'discovery': setupDiscoveryEvents(); break;
      case 'review': setupReviewEvents(); break;
    }
  }

  function setupWelcomeEvents() {
    $(document).off('click.bpw-level').on('click.bpw-level', '[data-action="set-level"]', function() {
      W.brandLevel = $(this).data('level');
      W.data.meta = W.data.meta || {};
      W.data.meta.brand_level = W.brandLevel;
      buildSteps();
      render();
    });

    $(document).off('change.bpw-lang').on('change.bpw-lang', '[data-field="language"]', function() {
      W.language = $(this).val();
    });
  }

  function setupDetectEvents() {
    $(document).off('click.bpw-does').on('click.bpw-does', '[data-action="toggle-does"]', function() {
      var id = $(this).data('id');
      var idx = W.detection.does.indexOf(id);
      if (idx !== -1) W.detection.does.splice(idx, 1);
      else W.detection.does.push(id);
      applyDetection();
      render();
    });

    $(document).off('click.bpw-where').on('click.bpw-where', '[data-action="set-where"]', function() {
      W.detection.where = $(this).data('id');
      applyDetection();
      render();
    });

    $(document).off('click.bpw-rev').on('click.bpw-rev', '[data-action="toggle-revenue"]', function() {
      var id = $(this).data('id');
      var idx = W.detection.revenue.indexOf(id);
      if (idx !== -1) W.detection.revenue.splice(idx, 1);
      else W.detection.revenue.push(id);
      applyDetection();
      render();
    });
  }

  function setupBasicsEvents() {
    $(document).off('blur.bpw-basics').on('blur.bpw-basics', '.bpw-step-card [data-field]', function() {
      var field = $(this).data('field');
      var val = $(this).val();
      if (field === 'ai-provider-setup' || field === 'ai-model-setup') return;
      W.seedContext[field] = val;
      W.dirty = true;
    });
  }

  function setupImportEvents() {
    $(document).off('click.bpw-scrape').on('click.bpw-scrape', '[data-action="scrape-url"]', function() {
      var url = $('[data-field="import-website-url"]').val();
      if (!url || !url.trim()) { toast('Enter a URL to analyze', 'warning'); return; }
      toast('Scraping: ' + url + ' (AI pipeline will process in next phase)', 'info');
      W.importedAssets.website = { url: url, status: 'loading' };
      render();
    });

    $(document).off('click.bpw-add-social').on('click.bpw-add-social', '[data-action="add-social-row"]', function() {
      W._socialRows = (W._socialRows || 1) + 1;
      render();
    });

    $(document).off('blur.bpw-import-paste').on('blur.bpw-import-paste', '[data-field="pasted_documents"]', function() {
      W.importedAssets.pasted_documents = $(this).val();
      W.dirty = true;
    });
  }

  function setupDiscoveryEvents() {
    $(document).off('click.bpw-radio').on('click.bpw-radio', '[data-action="select-radio"]', function() {
      var qid = $(this).data('qid');
      var idx = parseInt($(this).data('index'), 10);
      W.discoveryAnswers[qid] = W.discoveryAnswers[qid] || {};
      W.discoveryAnswers[qid].selected = idx;
      render();
    });

    $(document).off('blur.bpw-discovery-text').on('blur.bpw-discovery-text', '[data-field^="discovery-text-"]', function() {
      var field = $(this).data('field');
      var qid = field.replace('discovery-text-', '');
      W.discoveryAnswers[qid] = W.discoveryAnswers[qid] || {};
      W.discoveryAnswers[qid].text = $(this).val();
    });

    $(document).off('blur.bpw-discovery-detail').on('blur.bpw-discovery-detail', '[data-field^="discovery-detail-"]', function() {
      var field = $(this).data('field');
      var qid = field.replace('discovery-detail-', '');
      W.discoveryAnswers[qid] = W.discoveryAnswers[qid] || {};
      W.discoveryAnswers[qid].detail = $(this).val();
    });

    // G21: Skip question handler
    $(document).off('click.bpw-skip-q').on('click.bpw-skip-q', '[data-action="skip-question"]', function(e) {
      e.preventDefault();
      var qid = $(this).data('id');
      if (qid) {
        W.discoveryAnswers[qid] = W.discoveryAnswers[qid] || {};
        W.discoveryAnswers[qid].skipped = true;
      }
      // Scroll to next question
      var $thisQ = $(this).closest('.bpw-question');
      var $nextQ = $thisQ.next('.bpw-question');
      if ($nextQ.length) {
        $nextQ[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        $nextQ.find('textarea, input').first().focus();
      }
      toast('Question skipped', 'info');
    });
  }

  function setupReviewEvents() {
    // G11: Review Edit — navigate to the corresponding wizard step
    $(document).off('click.bpw-review-edit').on('click.bpw-review-edit', '[data-action="review-edit"]', function(e) {
      e.preventDefault();
      var sectionKey = $(this).data('section');
      if (!sectionKey) return;
      var targetStep = _getStepForSection(sectionKey);
      if (targetStep) {
        console.log(LOG_PREFIX, 'Review edit:', sectionKey, '→ step:', targetStep);
        goStep(targetStep);
      } else {
        toast('Could not find step for: ' + sectionKey, 'warning');
      }
    });

    // complete-wizard and export-json are owned by Part 2B.
    // Fallbacks here if Part 2B hasn't loaded after 3s.
    setTimeout(function() {
      if (window._bpwPart2B && window._bpwPart2B.initialized) return;

      $(document).off('click.bpw-complete-fallback').on('click.bpw-complete-fallback', '[data-action="complete-wizard"]', function() {
        _mergeSeedIntoIdentity();
        var profile = buildFinalProfile();
        profile.meta.wizard_status = 'complete';
        W.$textarea.val(JSON.stringify(profile));
        drupalSave();
        toast('Brand profile saved!', 'success');
      });

      $(document).off('click.bpw-export-fallback').on('click.bpw-export-fallback', '[data-action="export-json"]', function() {
        _mergeSeedIntoIdentity();
        var profile = buildFinalProfile();
        var blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (W.seedContext.name || 'brand-profile') + '.json';
        a.click();
        URL.revokeObjectURL(url);
        toast('JSON exported', 'success');
      });
    }, 3000);
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
