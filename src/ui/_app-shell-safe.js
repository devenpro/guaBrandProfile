/**
 * @category    ui
 * @purpose     Error boundary for the app shell. Purely additive:
 *              wraps the public _bpwAppShell API and installs a
 *              window-error backstop scoped to body.bpw-app-shell-active.
 *              Renders a crash card with reload button when render
 *              throws uncaught.
 *
 *              Does NOT edit app-shell.js. The wrap is an additive
 *              monkey-patch applied after app-shell.js installs its
 *              global. Internal IIFE-local render() calls (handler-
 *              triggered re-renders) bypass the public-API wrap, but
 *              their uncaught throws are caught by the window-error
 *              backstop while the shell is active.
 *
 * @exports     window._bpwCrashCard
 *                = { render(err), show(err) }
 *
 * @depends-on  window.jQuery, window._bpwAppShell (waits for it)
 */
(function() {
  'use strict';

  var $ = window.jQuery;
  var LOG = '[BPW-safe]';
  var _shown = 0;
  var MAX_SHOWS = 3;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, function(c) {
      return { '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function _crashCardHTML(err) {
    var msg = (err && (err.message || String(err))) || 'Unknown error';
    var stack = (err && err.stack) || '';
    var version = window.BPW_VERSION || 'unknown';
    var build = window.BPW_BUILD_TIME || 'unknown';
    var cardStyle = [
      'max-width:640px',
      'margin:48px auto',
      'padding:24px 28px',
      'background:#fff',
      'border:1px solid #e3e3e3',
      'border-radius:8px',
      'box-shadow:0 2px 12px rgba(0,0,0,0.06)',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'color:#222'
    ].join(';');
    var btnStyle = [
      'margin-top:8px',
      'padding:8px 16px',
      'background:#5b8def',
      'color:#fff',
      'border:0',
      'border-radius:4px',
      'font-size:14px',
      'cursor:pointer'
    ].join(';');
    var preStyle = [
      'background:#f7f7f7',
      'border:1px solid #eee',
      'border-radius:4px',
      'padding:12px',
      'font-size:12px',
      'overflow:auto',
      'max-height:240px',
      'white-space:pre-wrap'
    ].join(';');
    return '<div class="bpw-crash-card" role="alert" style="' + cardStyle + '">'
      + '<h2 style="margin:0 0 8px;font-size:18px;color:#c0392b;">The Brand Profile Wizard hit an error.</h2>'
      + '<p style="margin:0 0 12px;">Your last saved work is unaffected. Reload the page to recover.</p>'
      + '<button type="button" onclick="window.location.reload()" style="' + btnStyle + '">Reload page</button>'
      + '<details style="margin-top:16px;">'
      + '<summary style="cursor:pointer;color:#666;font-size:13px;">Technical details (BPW v' + _esc(version) + ')</summary>'
      + '<pre style="' + preStyle + '">' + _esc(msg + '\n\n' + stack) + '</pre>'
      + '<p style="margin:8px 0 0;color:#888;font-size:12px;">Build: ' + _esc(build) + '</p>'
      + '</details>'
      + '</div>';
  }

  function _show(err) {
    if (_shown >= MAX_SHOWS) return;
    _shown++;
    try {
      console.error(LOG, 'Shell render crashed:', err);
      var html = _crashCardHTML(err);
      var $shell = $('#bpwAppShell');
      if ($shell.length) {
        $shell.html(html);
      } else {
        $('body').append('<div id="bpwAppShell" class="bpw-shell">' + html + '</div>');
      }
    } catch (e) {
      // The crash card itself failed; console already has the original error.
    }
  }

  function _wrapPublicAPI() {
    var api = window._bpwAppShell;
    if (!api || api.__safeWrapped) return false;
    var origRender = api.render;
    var origRenderIfReady = api.renderIfReady;
    if (typeof origRender === 'function') {
      api.render = function() {
        try { return origRender.apply(this, arguments); }
        catch (e) { _show(e); }
      };
    }
    if (typeof origRenderIfReady === 'function') {
      api.renderIfReady = function() {
        try { return origRenderIfReady.apply(this, arguments); }
        catch (e) { _show(e); }
      };
    }
    api.__safeWrapped = true;
    return true;
  }

  // app-shell.js installs window._bpwAppShell synchronously inside its
  // IIFE, so by the time this file's IIFE runs (loaded immediately
  // after in index.js) the global should already exist. Poll briefly
  // as a fallback in case the load order ever shifts.
  if (!_wrapPublicAPI()) {
    var _tries = 0;
    var _t = setInterval(function() {
      if (_wrapPublicAPI() || ++_tries > 200) clearInterval(_t);
    }, 50);
  }

  // Window-error backstop. Scoped to the BPW shell so this listener is
  // a no-op on every page that isn't running BPW.
  function _bpwActive() {
    var b = document.body;
    return !!(b && b.className && b.className.indexOf('bpw-app-shell-active') !== -1);
  }
  window.addEventListener('error', function(evt) {
    if (!_bpwActive() || !evt || !evt.error) return;
    _show(evt.error);
  });
  window.addEventListener('unhandledrejection', function(evt) {
    if (!_bpwActive() || !evt) return;
    _show(evt.reason || new Error('Unhandled promise rejection'));
  });

  window._bpwCrashCard = { render: _crashCardHTML, show: _show };
})();
