/**
 * Brand Profile Wizard — Part 2C: Activity Log instrumentation
 * Weight: -97 (loads after Part 2B)
 *
 * Provides:
 * - Real-time activity logging instrumentation (wraps acceptSection,
 *   runStepAI, saveProgress to emit events into W.activityLog).
 *
 * The legacy slide-out activity-log panel and settings modal that
 * lived here were superseded by src/ui/activity-drawer.js and
 * src/ui/views/settings.js, and have been removed. The event handlers
 * for [data-action="open-activity-log"], [data-action="open-settings"],
 * [data-action="save-settings"], and [data-action="close-panel"] went
 * with them — those buttons aren't rendered anywhere now.
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
  // SECTION 3: BOOT
  // ============================================================

  if (typeof $ !== 'undefined') {
    waitForDeps();
  } else if (typeof jQuery !== 'undefined') {
    $ = jQuery;
    waitForDeps();
  }

})(jQuery);
