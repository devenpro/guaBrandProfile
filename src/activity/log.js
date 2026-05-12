// Real-time activity logger. Appends events to W.activityLog and
// trims to the last 500 entries.
import { W } from '../core/state.js';
import { now } from '../utils/helpers.js';
import { stepById } from '../core/steps.js';

export function logActivity(action, details) {
  W.activityLog = W.activityLog || [];
  W.activityLog.push({
    action: action,
    details: details || {},
    timestamp: now()
  });
  if (W.activityLog.length > 500) W.activityLog = W.activityLog.slice(-500);
}

// Returns the live W.activityLog when populated, otherwise reconstructs
// a best-effort log from completedSteps + sectionStates so the
// field_activity_log export always has something useful.
export function buildActivityLog() {
  if (W.activityLog && W.activityLog.length > 0) return W.activityLog;

  var log = [];
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
