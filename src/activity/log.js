// Real-time activity logger. Appends events to W.activityLog and
// trims to the last 500 entries.
import { W } from '../core/state.js';
import { now } from '../utils/helpers.js';

export function logActivity(action, details) {
  W.activityLog = W.activityLog || [];
  W.activityLog.push({
    action: action,
    details: details || {},
    timestamp: now()
  });
  if (W.activityLog.length > 500) W.activityLog = W.activityLog.slice(-500);
}
