/**
 * @category    ui
 * @purpose     Shared "refine with AI" modal. Used by:
 *                — Per-field ✨ Improve buttons next to every editor.
 *                — Per-section 🔄 Regenerate buttons in the list header.
 *                — Setup workflow-stage-3 per-AI-stage "Re-run with
 *                  my edits" replacing the inline form-based re-run.
 *
 *              One DOM instance (mounted lazily on first open).
 *              Carries: title + subtitle, custom-instructions textarea
 *              (sticky last-used), provider + model selects, Cancel /
 *              Run buttons. Run delegates to window._bpwRefine, which
 *              Phase 9 supplies (refineField / refineSection). Until
 *              Phase 9 lands, Run just toasts intent so the wiring is
 *              testable end-to-end.
 *
 * @exports     window._bpwRefineModal = {
 *                openField(path, label),
 *                openSection(sectionId, label)
 *              }
 *
 * @depends-on  window.LLMService, window._bpwToast, jQuery
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

  // Sticky last-used instructions — seeded from seedContext on first
  // open, then preserved across opens within the session.
  var _lastInstructions = null;

  var _ctx = null; // { type: 'field'|'section', target, label }

  function openField(path, label) {
    _ctx = { type: 'field', target: path, label: label || path };
    _render();
  }

  function openSection(sectionId, label) {
    _ctx = { type: 'section', target: sectionId, label: label || sectionId };
    _render();
  }

  function close() {
    $('.bpw-refine-modal').remove();
    $('.bpw-refine-scrim').remove();
    _ctx = null;
  }

  function _seedInstructions() {
    if (_lastInstructions != null) return _lastInstructions;
    var W = window._bpwState;
    var seed = (W && W.seedContext && W.seedContext.customInstructions) || '';
    return seed;
  }

  function _render() {
    if (!_ctx) return;
    close();

    var configured = window.LLMService && window.LLMService.isConfigured();
    var W = window._bpwState;
    var providerLabel = (W && W.aiProvider) || '';

    var subtitle = _ctx.type === 'field'
      ? 'Tell the AI what to change. We\'ll keep the rest of the brand profile as context.'
      : 'Re-run this whole section. Existing edits in this section will be replaced.';

    var html = '<div class="bpw-refine-scrim" data-refine-close></div>';
    html += '<div class="bpw-refine-modal" role="dialog" aria-modal="true" aria-label="Refine with AI">';
    html += '<header class="bpw-refine-header">';
    html += '<div class="bpw-refine-title-block">';
    html += '<h3 class="bpw-refine-title">' + _icon('sparkles') + ' Refine: <span class="bpw-refine-target">' + _esc(_ctx.label) + '</span></h3>';
    html += '<p class="bpw-refine-subtitle">' + _esc(subtitle) + '</p>';
    html += '</div>';
    html += '<button class="bpw-refine-close" data-refine-close type="button" title="Close">' + _icon('xmark') + '</button>';
    html += '</header>';

    html += '<div class="bpw-refine-body">';

    html += '<div class="bpw-refine-field">';
    html += '<label for="bpw-refine-instructions" class="bpw-refine-label">What should the AI change?</label>';
    html += '<textarea id="bpw-refine-instructions" class="bpw-refine-textarea" rows="5" placeholder="e.g. Make the tone bolder. Reference our craftsmanship more explicitly. Cut anything generic.">' + _esc(_seedInstructions()) + '</textarea>';
    html += '</div>';

    html += '<div class="bpw-refine-field bpw-refine-ai">';
    html += '<label class="bpw-refine-label">AI provider</label>';
    if (configured) {
      html += '<div class="bpw-refine-ai-selects">';
      html += '<div data-refine-provider-slot>' + window.LLMService.renderProviderSelect() + '</div>';
      html += '<div data-refine-model-slot>' + window.LLMService.renderModelSelect() + '</div>';
      html += '</div>';
      html += '<p class="bpw-refine-hint">' + _icon('circle-info') + ' Override here applies only to this refine. Your default stays untouched.</p>';
    } else {
      html += '<div class="bpw-refine-warn">' + _icon('triangle-exclamation') + ' No AI providers configured — add credentials in Drupal AI settings.</div>';
    }
    html += '</div>';
    html += '</div>';

    html += '<footer class="bpw-refine-footer">';
    html += '<button class="bpw-refine-btn bpw-refine-btn-cancel" data-refine-close type="button">Cancel</button>';
    var disabled = configured ? '' : ' disabled';
    html += '<button class="bpw-refine-btn bpw-refine-btn-run" data-refine-run type="button"' + disabled + '>' + _icon('wand-magic-sparkles') + ' Run refine</button>';
    html += '</footer>';
    html += '</div>';

    $('body').append(html);
    // Focus the textarea so users can just start typing.
    setTimeout(function() { $('#bpw-refine-instructions').focus(); }, 0);
  }

  // ── Events ────────────────────────────────────────────────────────
  $(document).off('click.bpw-refine', '[data-refine-close]')
    .on('click.bpw-refine', '[data-refine-close]', function(e) {
      e.preventDefault();
      close();
    });

  // Page-style sparkle button (used by identity/voice/etc. views and
  // by the wizard's review pane). v3: opens the field menu popover
  // (window._bpwFieldMenu) which offers Improve / Regenerate / Copy.
  // If the menu module hasn't loaded yet, fall back to the legacy
  // direct-open behavior.
  $(document).off('click.bpw-refine-trigger', '[data-action="refine"][data-refine-path]')
    .on('click.bpw-refine-trigger', '[data-action="refine"][data-refine-path]', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var path = $(this).attr('data-refine-path');
      var label = $(this).closest('.bpw-page-field').find('.bpw-page-field-label').text() || path;
      if (window._bpwFieldMenu && window._bpwFieldMenu.openMenu) {
        window._bpwFieldMenu.openMenu(this, path, label);
      } else {
        openField(path, label);
      }
    });

  // Provider change inside the modal — re-render the model select so
  // the options match the chosen provider. LLMService already wires
  // the data-field="ai-provider-setup" change globally to mutate
  // W.aiProvider — we just need to refresh the model options here.
  $(document).off('change.bpw-refine-provider', '.bpw-refine-modal [data-field="ai-provider-setup"]')
    .on('change.bpw-refine-provider', '.bpw-refine-modal [data-field="ai-provider-setup"]', function() {
      var W = window._bpwState;
      W.aiProvider = $(this).val();
      var models = window.LLMService.getActiveModels(W.aiProvider);
      if (models && models[0]) W.aiModel = models[0].id;
      $('.bpw-refine-modal [data-refine-model-slot]').html(window.LLMService.renderModelSelect());
    });

  $(document).off('change.bpw-refine-model', '.bpw-refine-modal [data-field="ai-model-setup"]')
    .on('change.bpw-refine-model', '.bpw-refine-modal [data-field="ai-model-setup"]', function() {
      var W = window._bpwState;
      W.aiModel = $(this).val();
    });

  // Run — capture state and hand off to the refine engine. Phase 9
  // populates window._bpwRefine; until then this toasts intent.
  $(document).off('click.bpw-refine-run', '[data-refine-run]')
    .on('click.bpw-refine-run', '[data-refine-run]', function(e) {
      e.preventDefault();
      if (!_ctx) return;
      var instructions = ($('#bpw-refine-instructions').val() || '').trim();
      _lastInstructions = instructions;
      var W = window._bpwState;
      var providerOverride = { provider: W.aiProvider, model: W.aiModel };

      if (window._bpwRefine) {
        var $btn = $(this).prop('disabled', true).html(_icon('spinner fa-spin') + ' Refining…');
        var done = function(res) {
          $btn.prop('disabled', false).html(_icon('wand-magic-sparkles') + ' Run refine');
          if (res && res.error) {
            if (window._bpwToast) window._bpwToast(res.error, 'error');
            return;
          }
          if (window._bpwToast) window._bpwToast('Refined ' + (_ctx ? _ctx.label : ''), 'success');
          close();
          if (window._bpwAppShell) window._bpwAppShell.render();
        };
        if (_ctx.type === 'field') {
          window._bpwRefine.refineField(_ctx.target, instructions, providerOverride, done);
        } else {
          window._bpwRefine.refineSection(_ctx.target, instructions, providerOverride, done);
        }
        return;
      }

      // Phase 8 fallback — no engine yet.
      if (window._bpwToast) window._bpwToast('Refine engine not loaded yet (Phase 9). Captured: ' + _ctx.type + ' "' + _ctx.label + '"', 'info');
      console.log('[BPW-refine] would refine', _ctx, { instructions: instructions, providerOverride: providerOverride });
      close();
    });

  // Esc to close.
  $(document).off('keydown.bpw-refine').on('keydown.bpw-refine', function(e) {
    if (e.key === 'Escape' && $('.bpw-refine-modal').length) close();
  });

  window._bpwRefineModal = {
    openField: openField,
    openSection: openSection,
    close: close
  };
})();
