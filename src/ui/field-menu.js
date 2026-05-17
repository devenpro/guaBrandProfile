/**
 * @category    ui
 * @purpose     Per-field sparkle dropdown menu for page-style views.
 *              Replaces the direct "open refine modal" behavior of
 *              data-action="refine" buttons with a 3-item popover:
 *                — Improve with prompt…  (opens refine modal)
 *                — Regenerate            (refines with no instructions)
 *                — Copy                  (writes value to clipboard)
 *
 * @exports     window._bpwFieldMenu = { openMenu(button, path, label) }
 * @depends-on  window._bpwRefineModal, window._bpwRefine,
 *              window._bpwPathStore, window._bpwToast, jQuery
 */
(function() {
  'use strict';

  var $ = window.jQuery;
  var LOG = '[BPW-field-menu]';

  function _icon(n) {
    return (window._bpwIcon || function(name) {
      if (!name) return '';
      if (name.indexOf('fa-') === 0) return '<i class="' + name + '"></i>';
      return '<i class="fa-solid fa-' + name + '"></i>';
    })(n);
  }

  function _esc(s) {
    return (window._bpwEsc || function(x) {
      if (x == null) return '';
      return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    })(s);
  }

  function close() {
    $('.bpw-field-menu').remove();
    $(document).off('click.bpw-field-menu-dismiss keydown.bpw-field-menu-dismiss');
  }

  function openMenu(buttonEl, path, label) {
    close();
    if (!buttonEl || !path) return;

    var $btn = $(buttonEl);
    var rect = buttonEl.getBoundingClientRect();
    var top = rect.bottom + window.scrollY + 4;
    var left = rect.right + window.scrollX - 180; // 180px menu width
    if (left < 8) left = 8;

    var html = '<div class="bpw-field-menu" role="menu" style="position:absolute;top:' + top + 'px;left:' + left + 'px;">'
      + '<button class="bpw-field-menu-item" data-field-menu="improve" type="button">' + _icon('wand-magic-sparkles') + ' Improve with prompt…</button>'
      + '<button class="bpw-field-menu-item" data-field-menu="regenerate" type="button">' + _icon('rotate-right') + ' Regenerate</button>'
      + '<button class="bpw-field-menu-item" data-field-menu="copy" type="button">' + _icon('copy') + ' Copy</button>'
      + '</div>';
    $('body').append(html);

    var $menu = $('.bpw-field-menu').last();
    $menu.data('path', path);
    $menu.data('label', label || path);

    // Dismiss on outside click / Escape.
    setTimeout(function() {
      $(document).on('click.bpw-field-menu-dismiss', function(e) {
        if ($(e.target).closest('.bpw-field-menu, [data-action="refine"]').length) return;
        close();
      });
      $(document).on('keydown.bpw-field-menu-dismiss', function(e) {
        if (e.key === 'Escape') close();
      });
    }, 0);
  }

  function _regenerate(path, label) {
    var refine = window._bpwRefine;
    if (!refine || !refine.refineField) {
      if (window._bpwToast) window._bpwToast('Refine engine not loaded.', 'error');
      return;
    }
    if (window._bpwToast) window._bpwToast('Regenerating ' + (label || path) + '…', 'info');
    refine.refineField(path, '', null, function(res) {
      if (res && res.success) {
        if (window._bpwToast) window._bpwToast('Regenerated ' + (label || path), 'success');
      } else {
        if (window._bpwToast) window._bpwToast('Regenerate failed: ' + ((res && res.error) || 'unknown'), 'error');
      }
    });
  }

  function _copy(path, label) {
    var store = window._bpwPathStore;
    if (!store) return;
    var value = store.get(path);
    var text = '';
    if (value == null) text = '';
    else if (typeof value === 'string') text = value;
    else { try { text = JSON.stringify(value, null, 2); } catch (e) { text = String(value); } }

    var ok = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        if (window._bpwToast) window._bpwToast('Copied ' + (label || path), 'success');
      }, function(err) {
        console.warn(LOG, 'clipboard write failed', err);
        if (window._bpwToast) window._bpwToast('Copy failed: ' + (err.message || err), 'error');
      });
      ok = true;
    }
    if (!ok) {
      // Fallback: textarea + execCommand.
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (window._bpwToast) window._bpwToast('Copied ' + (label || path), 'success');
      } catch (e) {
        if (window._bpwToast) window._bpwToast('Copy failed.', 'error');
      }
    }
  }

  // Menu item click dispatch.
  $(document).off('click.bpw-field-menu', '.bpw-field-menu [data-field-menu]')
    .on('click.bpw-field-menu', '.bpw-field-menu [data-field-menu]', function(e) {
      e.preventDefault();
      var $menu = $(this).closest('.bpw-field-menu');
      var path = $menu.data('path');
      var label = $menu.data('label');
      var action = $(this).attr('data-field-menu');
      close();
      if (action === 'improve') {
        if (window._bpwRefineModal) window._bpwRefineModal.openField(path, label);
      } else if (action === 'regenerate') {
        _regenerate(path, label);
      } else if (action === 'copy') {
        _copy(path, label);
      }
    });

  window._bpwFieldMenu = { openMenu: openMenu, close: close };
})();
