/**
 * @category    ui
 * @purpose     Slide-out activity drawer (right side, 360px). Shows the
 *              recent activity log entries — section accepts, stage
 *              completions, AI runs. Reads W.activityLog (legacy) or
 *              field_activity_log JSON if present.
 *
 * @exports     window._bpwActivityDrawer = { render(W) }
 */
(function() {
  'use strict';

  function _esc(s) {
    return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s);
  }
  function _icon(n) {
    return (window._bpwIcon || function(name) {
      if (!name) return '';
      if (name.indexOf('fa-') === 0) return '<i class="' + name + '"></i>';
      return '<i class="fa-solid fa-' + name + '"></i>';
    })(n);
  }
  function _fmtRel(ts) {
    var formatter = window._bpwFormatRelativeTime;
    if (formatter) return formatter(ts);
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function _readLog(W) {
    if (W.activityLog && W.activityLog.length) return W.activityLog;
    // Legacy: field_activity_log JSON.
    var $ = window.jQuery;
    if (!$) return [];
    var $ta = $('#edit-field-activity-log-0-value');
    if (!$ta.length) return [];
    try { return JSON.parse($ta.val() || '[]') || []; } catch (e) { return []; }
  }

  function render(W) {
    var open = !!(W.ui && W.ui.activityOpen);
    var entries = _readLog(W).slice().reverse().slice(0, 200);

    var html = '<aside class="bpw-shell-drawer ' + (open ? 'bpw-shell-drawer-open' : '') + '" role="complementary" aria-label="Activity log" aria-hidden="' + (open ? 'false' : 'true') + '">';
    html += '<header class="bpw-shell-drawer-header">';
    html += '<h3>' + _icon('clock-rotate-left') + ' Activity</h3>';
    html += '<button class="bpw-shell-drawer-close" data-action="close-activity" type="button" aria-label="Close">' + _icon('xmark') + '</button>';
    html += '</header>';
    html += '<div class="bpw-shell-drawer-body">';

    if (!entries.length) {
      html += '<div class="bpw-shell-drawer-empty">' + _icon('inbox') + '<p>No activity yet.</p></div>';
    } else {
      html += '<ul class="bpw-shell-drawer-list">';
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i] || {};
        var when = _fmtRel(e.timestamp);
        var verb = (e.action || 'event').replace(/_/g, ' ');
        var subject = e.label || e.section || e.step || '';
        var meta = e.source ? ' · ' + e.source : '';
        html += '<li class="bpw-shell-drawer-item">';
        html += '<div class="bpw-shell-drawer-item-head"><span class="bpw-shell-drawer-verb">' + _esc(verb) + '</span><span class="bpw-shell-drawer-time">' + _esc(when) + '</span></div>';
        if (subject) html += '<div class="bpw-shell-drawer-subject">' + _esc(subject) + _esc(meta) + '</div>';
        html += '</li>';
      }
      html += '</ul>';
    }

    html += '</div></aside>';
    if (open) html += '<div class="bpw-shell-drawer-scrim" data-action="close-activity"></div>';
    return html;
  }

  window._bpwActivityDrawer = { render: render };
})();
