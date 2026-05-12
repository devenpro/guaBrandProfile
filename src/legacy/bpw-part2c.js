/**
 * Brand Profile Wizard — Part 2C: Activity Log & Settings
 * Weight: -97 (loads after Part 2B)
 *
 * Provides:
 * - Real-time activity logging instrumentation
 * - Activity Log slide-out panel UI
 * - Settings modal UI
 * - Event wiring for navbar buttons
 */
(function($) {
  'use strict';

  var LOG = '[BPW-2C]';
  var POLL_INTERVAL = 100;
  var MAX_WAIT = 15000;

  // ============================================================
  // SECTION 1: INIT & IMPORTS
  // ============================================================

  var W, render, autoSave, toast, esc, icon, logActivity, formatRelativeTime;
  var LLMService, now;
  var Part1Ready = false, Part2BReady = false;

  function waitForDeps() {
    var elapsed = 0;
    var timer = setInterval(function() {
      elapsed += POLL_INTERVAL;
      if (elapsed > MAX_WAIT) {
        clearInterval(timer);
        console.warn(LOG, 'Timed out waiting for dependencies');
        return;
      }

      var ws = window._bpwState;
      if (!ws || !ws.initialized) return;
      if (!window._bpwPart2B || !window._bpwPart2B.initialized) return;

      clearInterval(timer);
      importGlobals();
      instrumentLogging();
      setupPart2CEvents();

      window._bpwPart2C = { initialized: true };
      console.log(LOG, 'Part 2C initialized');
    }, POLL_INTERVAL);
  }

  function importGlobals() {
    W = window._bpwState;
    render = window._bpwRender;
    autoSave = window._bpwAutoSave;
    toast = window._bpwToast;
    esc = window._bpwEsc;
    icon = window._bpwIcon;
    logActivity = window._bpwLogActivity;
    formatRelativeTime = window._bpwFormatRelativeTime;
    LLMService = window._bpwLLMService;
    now = function() { return new Date().toISOString(); };
  }

  // ============================================================
  // SECTION 2: ACTIVITY LOGGING INSTRUMENTATION
  // ============================================================

  function instrumentLogging() {
    // Wrap the accept section override to add logging
    var originalOverride = window._bpwAcceptSectionOverride;
    if (originalOverride) {
      window._bpwAcceptSectionOverride = function(key, data) {
        originalOverride(key, data);
        logActivity('section_accepted', { section: key, source: W.generatedSections[key] ? 'ai' : 'manual' });
      };
    }

    // Wrap Part 2A's runStepAI to log AI generation starts
    var Part2A = window._bpwPart2A;
    if (Part2A && Part2A.runStepAI) {
      var originalRunStepAI = Part2A.runStepAI;
      Part2A.runStepAI = function(stepKey) {
        logActivity('ai_generation_start', { step: stepKey });
        originalRunStepAI(stepKey);
      };
    }

    // Log saves
    var originalSaveProgress = window._bpwSaveProgress;
    if (originalSaveProgress) {
      window._bpwSaveProgress = function() {
        logActivity('save', { step: W.currentStepId });
        originalSaveProgress();
      };
    }

    console.log(LOG, 'Activity logging instrumented');
  }

  // ============================================================
  // SECTION 3: ACTIVITY LOG PANEL UI
  // ============================================================

  var ACTIVITY_ICONS = {
    ai_generation_start: 'wand-magic-sparkles',
    ai_generation_complete: 'check-circle',
    section_accepted: 'check',
    section_rejected: 'xmark',
    section_edited: 'pen',
    redo_requested: 'arrow-rotate-left',
    scrape_completed: 'globe',
    save: 'floppy-disk',
    step_completed: 'flag-checkered',
    mission_selected: 'bullseye'
  };

  var ACTIVITY_LABELS = {
    ai_generation_start: 'AI generation started',
    ai_generation_complete: 'AI generation completed',
    section_accepted: 'Section accepted',
    section_rejected: 'Section rejected',
    section_edited: 'Section edited',
    redo_requested: 'Redo requested',
    scrape_completed: 'URL scraped',
    save: 'Profile saved',
    step_completed: 'Step completed',
    mission_selected: 'Mission selected'
  };

  function renderActivityPanel() {
    var log = (W.activityLog || []).slice().reverse();
    var h = '';

    h += '<div class="bpw-panel-overlay" data-action="close-panel"></div>';
    h += '<div class="bpw-panel bpw-panel-right">';
    h += '<div class="bpw-panel-header">';
    h += '<div class="bpw-panel-title">' + icon('clock-rotate-left') + ' Activity Log</div>';
    h += '<button class="bpw-btn bpw-btn-ghost bpw-btn-sm" data-action="close-panel">' + icon('xmark') + '</button>';
    h += '</div>';

    // Filter buttons
    h += '<div class="bpw-panel-filters">';
    h += '<button class="bpw-filter-btn active" data-filter="all">All</button>';
    h += '<button class="bpw-filter-btn" data-filter="ai">AI</button>';
    h += '<button class="bpw-filter-btn" data-filter="edit">Edits</button>';
    h += '<button class="bpw-filter-btn" data-filter="save">Saves</button>';
    h += '</div>';

    h += '<div class="bpw-panel-body">';

    if (log.length === 0) {
      h += '<div class="bpw-panel-empty">' + icon('clock') + '<br>No activity yet. Actions will appear here as you work.</div>';
    } else {
      for (var i = 0; i < log.length; i++) {
        var entry = log[i];
        var action = entry.action || '';
        var details = entry.details || {};
        var iconName = ACTIVITY_ICONS[action] || 'circle';
        var label = ACTIVITY_LABELS[action] || action.replace(/_/g, ' ');
        var detail = '';

        // Build detail string
        if (details.section) detail = details.section.replace(/_/g, ' ');
        if (details.step) detail = details.step.replace(/_/g, ' ');
        if (details.label) detail = details.label;
        if (details.source) detail += ' (' + details.source + ')';

        // Category for filtering
        var category = 'other';
        if (action.indexOf('ai_') === 0) category = 'ai';
        if (action.indexOf('section_') === 0 || action === 'redo_requested') category = 'edit';
        if (action === 'save') category = 'save';

        h += '<div class="bpw-activity-entry" data-category="' + category + '">';
        h += '<div class="bpw-activity-icon">' + icon(iconName) + '</div>';
        h += '<div class="bpw-activity-content">';
        h += '<div class="bpw-activity-label">' + esc(label) + '</div>';
        if (detail) h += '<div class="bpw-activity-detail">' + esc(detail) + '</div>';
        h += '</div>';
        h += '<div class="bpw-activity-time">' + (entry.timestamp ? formatRelativeTime(entry.timestamp) : '') + '</div>';
        h += '</div>';
      }
    }

    h += '</div>';

    h += '<div class="bpw-panel-footer">';
    h += '<span class="bpw-panel-count">' + log.length + ' event' + (log.length !== 1 ? 's' : '') + '</span>';
    h += '</div>';
    h += '</div>';

    return h;
  }

  // ============================================================
  // SECTION 4: SETTINGS PANEL UI
  // ============================================================

  function renderSettingsPanel() {
    var h = '';

    h += '<div class="bpw-panel-overlay" data-action="close-panel"></div>';
    h += '<div class="bpw-panel bpw-panel-right">';
    h += '<div class="bpw-panel-header">';
    h += '<div class="bpw-panel-title">' + icon('gear') + ' Settings</div>';
    h += '<button class="bpw-btn bpw-btn-ghost bpw-btn-sm" data-action="close-panel">' + icon('xmark') + '</button>';
    h += '</div>';

    h += '<div class="bpw-panel-body">';

    // AI Preferences
    h += '<div class="bpw-settings-section">';
    h += '<div class="bpw-settings-title">' + icon('wand-magic-sparkles') + ' AI Preferences</div>';

    // Default provider
    if (LLMService && LLMService.isConfigured()) {
      var providers = LLMService.getActiveProviders ? LLMService.getActiveProviders() : [];
      if (providers.length > 0) {
        h += '<div class="bpw-settings-field">';
        h += '<label>Default Provider</label>';
        h += '<select class="bpw-select bpw-select-sm" data-setting="ai_provider">';
        for (var p = 0; p < providers.length; p++) {
          h += '<option value="' + esc(providers[p].id) + '"' + (W.aiProvider === providers[p].id ? ' selected' : '') + '>' + esc(providers[p].label) + '</option>';
        }
        h += '</select>';
        h += '</div>';
      }
    }

    // Custom instructions
    var aiPrefs = W.data.ai_preferences || {};
    h += '<div class="bpw-settings-field">';
    h += '<label>Custom AI Instructions</label>';
    h += '<textarea class="bpw-textarea bpw-textarea-sm" data-setting="custom_instructions" rows="3" placeholder="e.g., Always use formal tone, focus on B2B context...">' + esc(aiPrefs.custom_instructions || '') + '</textarea>';
    h += '</div>';
    h += '</div>';

    // Language
    var LANGUAGES = (window._bpwConstants && window._bpwConstants.LANGUAGES) || ['en'];
    var LANG_NAMES = (window._bpwConstants && window._bpwConstants.LANG_NAMES) || { en: 'English' };
    h += '<div class="bpw-settings-section">';
    h += '<div class="bpw-settings-title">' + icon('language') + ' Language</div>';
    h += '<div class="bpw-settings-field">';
    h += '<select class="bpw-select bpw-select-sm" data-setting="language">';
    for (var l = 0; l < LANGUAGES.length; l++) {
      h += '<option value="' + LANGUAGES[l] + '"' + (W.language === LANGUAGES[l] ? ' selected' : '') + '>' + esc(LANG_NAMES[LANGUAGES[l]] || LANGUAGES[l]) + '</option>';
    }
    h += '</select>';
    h += '</div>';
    h += '</div>';

    // Profile Info (read-only)
    h += '<div class="bpw-settings-section">';
    h += '<div class="bpw-settings-title">' + icon('circle-info') + ' Profile Info</div>';
    h += '<div class="bpw-settings-info"><strong>Brand Level:</strong> ' + esc(W.brandLevel || 'Not set') + '</div>';
    h += '<div class="bpw-settings-info"><strong>Brand Types:</strong> ' + esc((W.brandTypes || []).join(', ') || 'Not set') + '</div>';
    h += '<div class="bpw-settings-info"><strong>Schema Version:</strong> 2.0</div>';
    if (W.data.meta) {
      if (W.data.meta.created) h += '<div class="bpw-settings-info"><strong>Created:</strong> ' + esc(new Date(W.data.meta.created).toLocaleDateString()) + '</div>';
      if (W.data.meta.last_modified) h += '<div class="bpw-settings-info"><strong>Last Modified:</strong> ' + esc(formatRelativeTime(W.data.meta.last_modified)) + '</div>';
    }
    h += '</div>';

    h += '</div>';

    h += '<div class="bpw-panel-footer">';
    h += '<button class="bpw-btn bpw-btn-primary bpw-btn-sm" data-action="save-settings">' + icon('check') + ' Save Settings</button>';
    h += '</div>';
    h += '</div>';

    return h;
  }

  // ============================================================
  // SECTION 5: EVENT WIRING
  // ============================================================

  function setupPart2CEvents() {
    // Open activity log panel
    $(document).off('click.bpw2c-activity').on('click.bpw2c-activity', '[data-action="open-activity-log"]', function(e) {
      e.preventDefault();
      _showPanel(renderActivityPanel());
    });

    // Open settings panel
    $(document).off('click.bpw2c-settings').on('click.bpw2c-settings', '[data-action="open-settings"]', function(e) {
      e.preventDefault();
      _showPanel(renderSettingsPanel());
    });

    // Close panel
    $(document).off('click.bpw2c-close').on('click.bpw2c-close', '[data-action="close-panel"]', function(e) {
      e.preventDefault();
      _closePanel();
    });

    // Filter buttons in activity log
    $(document).off('click.bpw2c-filter').on('click.bpw2c-filter', '.bpw-filter-btn', function(e) {
      e.preventDefault();
      var filter = $(this).data('filter');
      $('.bpw-filter-btn').removeClass('active');
      $(this).addClass('active');

      if (filter === 'all') {
        $('.bpw-activity-entry').show();
      } else {
        $('.bpw-activity-entry').hide();
        $('.bpw-activity-entry[data-category="' + filter + '"]').show();
      }
    });

    // Save settings
    $(document).off('click.bpw2c-save-settings').on('click.bpw2c-save-settings', '[data-action="save-settings"]', function(e) {
      e.preventDefault();

      // Collect settings
      var newProvider = $('[data-setting="ai_provider"]').val();
      var newInstructions = $('[data-setting="custom_instructions"]').val();
      var newLanguage = $('[data-setting="language"]').val();

      if (newProvider && newProvider !== W.aiProvider) {
        W.aiProvider = newProvider;
        if (LLMService && LLMService.setProvider) LLMService.setProvider(newProvider);
      }
      if (newLanguage && newLanguage !== W.language) {
        W.language = newLanguage;
      }

      W.data.ai_preferences = W.data.ai_preferences || {};
      W.data.ai_preferences.custom_instructions = newInstructions || '';

      logActivity('settings_changed', { provider: newProvider, language: newLanguage });
      autoSave();
      _closePanel();
      toast('Settings saved', 'success');
    });

    // Close on Escape
    $(document).off('keydown.bpw2c-esc').on('keydown.bpw2c-esc', function(e) {
      if (e.key === 'Escape' && $('.bpw-panel-overlay').length) {
        _closePanel();
      }
    });

    console.log(LOG, 'Events wired');
  }

  // ============================================================
  // SECTION 6: PANEL HELPERS
  // ============================================================

  function _showPanel(html) {
    // Remove any existing panel
    _closePanel();
    $('body').append(html);
    // Animate in
    setTimeout(function() {
      $('.bpw-panel').addClass('open');
      $('.bpw-panel-overlay').addClass('open');
    }, 10);
  }

  function _closePanel() {
    var $panel = $('.bpw-panel');
    var $overlay = $('.bpw-panel-overlay');
    $panel.removeClass('open');
    $overlay.removeClass('open');
    setTimeout(function() {
      $panel.remove();
      $overlay.remove();
    }, 300);
  }

  // ============================================================
  // SECTION 7: BOOT
  // ============================================================

  if (typeof $ !== 'undefined') {
    waitForDeps();
  } else if (typeof jQuery !== 'undefined') {
    $ = jQuery;
    waitForDeps();
  }

})(jQuery);
