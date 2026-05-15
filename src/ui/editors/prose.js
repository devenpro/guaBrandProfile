/**
 * @category    ui.editors
 * @purpose     Tiptap-backed prose editor for long-form fields.
 *
 *              renderProse(opts) emits a placeholder div carrying the
 *              dotted-path and the initial text. After each shell
 *              render, mountAll() walks the DOM and mounts a Tiptap
 *              editor inside every un-initialised placeholder.
 *
 *              Storage is plain text (editor.getText()) — keeps the
 *              field_brand_core / field_brand_content export contract
 *              unchanged. Formatting is for editing UX only.
 *
 * @exports     window._bpwProse = { renderProse, mountAll, destroyAll }
 * @depends-on  @tiptap/core, @tiptap/starter-kit, window._bpwPathStore
 */
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

(function() {
  'use strict';

  // Maps placeholder DOM element → Editor instance. Used to skip
  // re-mounting on idempotent renders and to destroy old instances
  // before re-mounting after a path-store re-render.
  var _instances = new WeakMap();
  var _seq = 0;

  function _esc(s) {
    return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s);
  }

  // Lift plain text into minimal HTML (one paragraph per line) so
  // Tiptap can render it. Empty lines become empty paragraphs which
  // Tiptap collapses cleanly on getText().
  function _textToHTML(text) {
    if (text == null) return '';
    var lines = String(text).split(/\r?\n/);
    return lines.map(function(l) { return '<p>' + _esc(l) + '</p>'; }).join('');
  }

  function renderProse(opts) {
    opts = opts || {};
    var id = 'bpw-prose-' + (++_seq);
    var initial = opts.value == null ? '' : String(opts.value);
    var html = '<div class="bpw-editor bpw-editor--prose">';
    if (opts.label) html += '<label class="bpw-editor-label">' + _esc(opts.label) + '</label>';
    html += '<div class="bpw-prose-host" id="' + id + '" data-prose-path="' + _esc(opts.path) + '" data-prose-initial="' + _esc(initial) + '"';
    if (opts.placeholder) html += ' data-prose-placeholder="' + _esc(opts.placeholder) + '"';
    html += '></div>';
    html += '</div>';
    return html;
  }

  function mountAll(root) {
    root = root || document;
    var hosts = root.querySelectorAll('.bpw-prose-host:not([data-prose-mounted])');
    for (var i = 0; i < hosts.length; i++) _mountOne(hosts[i]);
    // Also clean up any mounted editors whose DOM node was removed
    // by a shell re-render — but WeakMap auto-collects, so we just
    // do nothing here.
  }

  function _mountOne(host) {
    var path = host.getAttribute('data-prose-path');
    if (!path) return;
    var initial = host.getAttribute('data-prose-initial') || '';
    var placeholder = host.getAttribute('data-prose-placeholder') || '';
    host.setAttribute('data-prose-mounted', '1');

    // Toolbar (above the editor surface).
    var toolbar = document.createElement('div');
    toolbar.className = 'bpw-prose-toolbar';
    toolbar.innerHTML = ''
      + '<button type="button" data-prose-cmd="bold" title="Bold"><b>B</b></button>'
      + '<button type="button" data-prose-cmd="italic" title="Italic"><i>I</i></button>'
      + '<button type="button" data-prose-cmd="bulletList" title="Bullet list">&bull;</button>'
      + '<button type="button" data-prose-cmd="orderedList" title="Numbered list">1.</button>';
    host.appendChild(toolbar);

    // Editor mount target.
    var mount = document.createElement('div');
    mount.className = 'bpw-prose-surface';
    if (placeholder) mount.setAttribute('data-placeholder', placeholder);
    host.appendChild(mount);

    var editor = new Editor({
      element: mount,
      extensions: [StarterKit],
      content: _textToHTML(initial),
      onUpdate: function(ev) {
        var text = ev.editor.getText();
        if (window._bpwPathStore) {
          window._bpwPathStore.set(path, text);
          window._bpwPathStore.persist();
        }
      }
    });

    _instances.set(host, editor);

    // Toolbar wiring.
    toolbar.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-prose-cmd]');
      if (!btn) return;
      e.preventDefault();
      var cmd = btn.getAttribute('data-prose-cmd');
      var chain = editor.chain().focus();
      if (cmd === 'bold')        chain.toggleBold().run();
      if (cmd === 'italic')      chain.toggleItalic().run();
      if (cmd === 'bulletList')  chain.toggleBulletList().run();
      if (cmd === 'orderedList') chain.toggleOrderedList().run();
    });
  }

  function destroyAll() {
    // Nothing to do — instances live in a WeakMap and are GC'd when
    // their DOM nodes detach. Tiptap also has its own cleanup on
    // element removal.
  }

  // Auto-mount after every shell render. Hooks into the existing
  // re-render path by wrapping _bpwAppShell.render once it appears.
  function _installHook() {
    if (window._bpwProse_hookInstalled) return;
    var shell = window._bpwAppShell;
    if (!shell || typeof shell.render !== 'function') {
      // Try again shortly — app-shell loads in the same tick but
      // mount order isn't guaranteed across IIFEs.
      setTimeout(_installHook, 50);
      return;
    }
    window._bpwProse_hookInstalled = true;
    var original = shell.render;
    shell.render = function() {
      var result = original.apply(this, arguments);
      try { mountAll(); } catch (e) { console.warn('[BPW-ui] prose mount failed', e); }
      return result;
    };
    // Initial mount in case the shell already rendered.
    try { mountAll(); } catch (e) {}
  }
  _installHook();

  window._bpwProse = {
    renderProse: renderProse,
    mountAll: mountAll,
    destroyAll: destroyAll
  };
})();
