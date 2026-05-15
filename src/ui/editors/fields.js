/**
 * @category    ui.editors
 * @purpose     Render helpers for editable fields used by every view's
 *              renderDetail pane. Markup carries data-path on every
 *              control; the global delegated handler at the bottom of
 *              this file routes changes back through path-store.
 *
 *              Field types:
 *                text     — single-line <input>
 *                textarea — multi-line plain text
 *                chips    — array of strings (add/remove pills)
 *                list     — array of objects, repeating mini-form
 *
 *              All editors keep their own value in W.acceptedSections
 *              under the given dotted path. Phase 6 layers Tiptap on
 *              top of `textarea` for prose keys.
 *
 * @exports     window._bpwEditors = {
 *                renderField, renderText, renderTextarea, renderChips,
 *                renderList
 *              }
 *
 * @depends-on  window._bpwPathStore, window._bpwEsc, window._bpwIcon
 */
(function() {
  'use strict';

  var $ = window.jQuery;

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

  // ── Single-line text ───────────────────────────────────────────────
  function renderText(opts) {
    opts = opts || {};
    var v = opts.value == null ? '' : String(opts.value);
    return '<div class="bpw-editor bpw-editor--text">'
      +    (opts.label ? '<label class="bpw-editor-label">' + _esc(opts.label) + '</label>' : '')
      +    '<input class="bpw-editor-input" type="text" data-path="' + _esc(opts.path) + '" value="' + _esc(v) + '"'
      +      (opts.placeholder ? ' placeholder="' + _esc(opts.placeholder) + '"' : '') + '>'
      +    '</div>';
  }

  // ── Multi-line text ────────────────────────────────────────────────
  function renderTextarea(opts) {
    opts = opts || {};
    var v = opts.value == null ? '' : String(opts.value);
    var rows = opts.rows || (opts.tall ? 6 : 3);
    return '<div class="bpw-editor bpw-editor--textarea">'
      +    (opts.label ? '<label class="bpw-editor-label">' + _esc(opts.label) + '</label>' : '')
      +    '<textarea class="bpw-editor-textarea' + (opts.tall ? ' is-tall' : '') + '" rows="' + rows + '" data-path="' + _esc(opts.path) + '"'
      +      (opts.placeholder ? ' placeholder="' + _esc(opts.placeholder) + '"' : '') + '>' + _esc(v) + '</textarea>'
      +    '</div>';
  }

  // ── Chips (array of strings) ───────────────────────────────────────
  function renderChips(opts) {
    opts = opts || {};
    var arr = Array.isArray(opts.value) ? opts.value : [];
    var html = '<div class="bpw-editor bpw-editor--chips" data-chips-path="' + _esc(opts.path) + '">';
    if (opts.label) html += '<label class="bpw-editor-label">' + _esc(opts.label) + '</label>';
    html += '<div class="bpw-editor-chips-list">';
    for (var i = 0; i < arr.length; i++) {
      html += '<span class="bpw-editor-chip">'
        +      '<input class="bpw-editor-chip-input" type="text" data-path="' + _esc(opts.path) + '[' + i + ']" value="' + _esc(arr[i] == null ? '' : String(arr[i])) + '">'
        +      '<button class="bpw-editor-chip-remove" data-action="bpw-editor-chip-remove" data-chips-path="' + _esc(opts.path) + '" data-chip-idx="' + i + '" type="button" title="Remove">' + _icon('xmark') + '</button>'
        +    '</span>';
    }
    html += '<button class="bpw-editor-chip-add" data-action="bpw-editor-chip-add" data-chips-path="' + _esc(opts.path) + '" type="button" title="Add">' + _icon('plus') + (opts.addLabel ? ' ' + _esc(opts.addLabel) : '') + '</button>';
    html += '</div></div>';
    return html;
  }

  // ── List (array of objects) ────────────────────────────────────────
  // opts.fields = [{ key, label, type: 'text'|'textarea'|'chips', placeholder, rows }]
  function renderList(opts) {
    opts = opts || {};
    var arr = Array.isArray(opts.value) ? opts.value : [];
    var fields = opts.fields || [];
    var html = '<div class="bpw-editor bpw-editor--list" data-list-path="' + _esc(opts.path) + '">';
    if (opts.label) html += '<div class="bpw-editor-list-label">' + _esc(opts.label) + '</div>';
    if (!arr.length) {
      html += '<div class="bpw-editor-list-empty">No items yet.</div>';
    } else {
      for (var i = 0; i < arr.length; i++) {
        var item = arr[i] || {};
        html += '<div class="bpw-editor-list-row" data-list-idx="' + i + '">';
        html += '<button class="bpw-editor-list-remove" data-action="bpw-editor-list-remove" data-list-path="' + _esc(opts.path) + '" data-list-idx="' + i + '" type="button" title="Remove">' + _icon('trash') + '</button>';
        for (var f = 0; f < fields.length; f++) {
          var fd = fields[f];
          var subPath = opts.path + '[' + i + '].' + fd.key;
          var subVal = item[fd.key];
          if (fd.type === 'textarea') {
            html += renderTextarea({ label: fd.label, path: subPath, value: subVal, placeholder: fd.placeholder, rows: fd.rows, tall: fd.tall });
          } else if (fd.type === 'chips') {
            html += renderChips({ label: fd.label, path: subPath, value: subVal, addLabel: fd.addLabel });
          } else {
            html += renderText({ label: fd.label, path: subPath, value: subVal, placeholder: fd.placeholder });
          }
        }
        html += '</div>';
      }
    }
    html += '<button class="bpw-editor-list-add" data-action="bpw-editor-list-add" data-list-path="' + _esc(opts.path) + '" data-list-template=\'' + _esc(JSON.stringify(opts.itemTemplate || {})) + '\' type="button">' + _icon('plus') + ' Add ' + _esc(opts.addLabel || 'item') + '</button>';
    html += '</div>';
    return html;
  }

  // ── Generic field router ───────────────────────────────────────────
  function renderField(opts) {
    opts = opts || {};
    switch (opts.type) {
      case 'prose':
        if (window._bpwProse) return window._bpwProse.renderProse(opts);
        // Fallback to textarea if prose module not loaded.
        return renderTextarea(opts);
      case 'textarea': return renderTextarea(opts);
      case 'chips':    return renderChips(opts);
      case 'list':     return renderList(opts);
      default:         return renderText(opts);
    }
  }

  // ── Event wiring ───────────────────────────────────────────────────
  // All inputs with data-path persist on input; text/textarea also fire
  // on blur (in case input never fired — e.g. paste then blur).
  $(document).off('input.bpw-editor change.bpw-editor', '[data-path]')
    .on('input.bpw-editor change.bpw-editor', '[data-path]', function() {
      var path = $(this).attr('data-path');
      if (!path) return;
      var $el = $(this);
      var val = $el.val();
      window._bpwPathStore.set(path, val);
      window._bpwPathStore.persist();
    });

  // Chip add
  $(document).off('click.bpw-editor-chip-add', '[data-action="bpw-editor-chip-add"]')
    .on('click.bpw-editor-chip-add', '[data-action="bpw-editor-chip-add"]', function(e) {
      e.preventDefault();
      var path = $(this).attr('data-chips-path');
      if (!path) return;
      window._bpwPathStore.push(path, '');
      window._bpwPathStore.persistAndRender();
    });

  // Chip remove
  $(document).off('click.bpw-editor-chip-remove', '[data-action="bpw-editor-chip-remove"]')
    .on('click.bpw-editor-chip-remove', '[data-action="bpw-editor-chip-remove"]', function(e) {
      e.preventDefault();
      var path = $(this).attr('data-chips-path');
      var idx = parseInt($(this).attr('data-chip-idx'), 10);
      if (!path || isNaN(idx)) return;
      window._bpwPathStore.removeAt(path, idx);
      window._bpwPathStore.persistAndRender();
    });

  // List add
  $(document).off('click.bpw-editor-list-add', '[data-action="bpw-editor-list-add"]')
    .on('click.bpw-editor-list-add', '[data-action="bpw-editor-list-add"]', function(e) {
      e.preventDefault();
      var path = $(this).attr('data-list-path');
      var tmpl = {};
      try { tmpl = JSON.parse($(this).attr('data-list-template') || '{}'); } catch (err) {}
      if (!path) return;
      window._bpwPathStore.push(path, _deepClone(tmpl));
      window._bpwPathStore.persistAndRender();
    });

  // List remove
  $(document).off('click.bpw-editor-list-remove', '[data-action="bpw-editor-list-remove"]')
    .on('click.bpw-editor-list-remove', '[data-action="bpw-editor-list-remove"]', function(e) {
      e.preventDefault();
      var path = $(this).attr('data-list-path');
      var idx = parseInt($(this).attr('data-list-idx'), 10);
      if (!path || isNaN(idx)) return;
      window._bpwPathStore.removeAt(path, idx);
      window._bpwPathStore.persistAndRender();
    });

  function _deepClone(o) {
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return {}; }
  }

  window._bpwEditors = {
    renderField: renderField,
    renderText: renderText,
    renderTextarea: renderTextarea,
    renderChips: renderChips,
    renderList: renderList
  };
})();
