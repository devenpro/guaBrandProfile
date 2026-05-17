/**
 * @category    ai
 * @purpose     Shared helpers for AI actions: structured-JSON parsing,
 *              brace-block extraction, brand-snippet builder, retry
 *              wrapper around LLMService.callAI, and the per-button
 *              loading-state manager (returns a restore closure).
 *
 * @exports     window._bpwAIHelpers
 *                { parseJSON, extractBraceBlock, brandSnippet,
 *                  callAIWithRetry, aiActionLoading }
 *
 * @depends-on  window.BrandService, window.LLMService (call-time)
 *              window._bpwToast (set by legacy/bpw-app.js:3519)
 *              window._bpwIcon  (set by legacy/bpw-app.js:3541)
 *              window.jQuery
 *
 * Pattern copied from /tmp/wcp-ref/src/ai/_helpers.js with the
 * BrandService accessor calls adapted to BPW's in-app context
 * (W.acceptedSections-backed, see src/ai/brand-service.js).
 */
(function() {
  'use strict';

  var $ = window.jQuery;

  // ── JSON PARSING ───────────────────────────────────────────────────
  function parseJSON(text) {
    if (!text || !text.trim()) throw new Error('Empty AI response');
    try { return JSON.parse(text); } catch (e) {}
    var cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    try { return JSON.parse(cleaned); } catch (e) {}
    var objStr = extractBraceBlock(cleaned, '{', '}');
    if (objStr) { try { return JSON.parse(objStr); } catch (e) {} }
    var arrStr = extractBraceBlock(cleaned, '[', ']');
    if (arrStr) { try { return JSON.parse(arrStr); } catch (e) {} }
    if (objStr) {
      var relaxed = objStr.replace(/,\s*([}\]])/g, '$1');
      try { return JSON.parse(relaxed); } catch (e) {}
    }
    throw new Error('Could not parse AI response as JSON');
  }

  function extractBraceBlock(text, openChar, closeChar) {
    var start = text.indexOf(openChar);
    if (start === -1) return null;
    var depth = 0, inStr = false, escaped = false;
    for (var i = start; i < text.length; i++) {
      var ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === openChar) depth++;
      if (ch === closeChar) {
        depth--;
        if (depth === 0) return text.substring(start, i + 1);
      }
    }
    return null;
  }

  // ── SEED DUMP ──────────────────────────────────────────────────────
  // Returns the effective brand-dump string. v2 prefers `seed.dump`
  // (single anchor textarea on the new wizard's Step 1). Falls back to
  // the legacy pair `description` + `customInstructions` so brands that
  // were set up with the old wizard keep working until a Phase-7 settings
  // edit promotes their data into the new field.
  function consolidateSeedDump(seed) {
    seed = seed || {};
    var dump = (seed.dump || '').trim();
    if (dump) return dump;
    var d = (seed.description || '').trim();
    var c = (seed.customInstructions || '').trim();
    if (d && c) return d + '\n\n' + c;
    return d || c || '';
  }

  // ── PHASE GUIDANCE ─────────────────────────────────────────────────
  // Returns a prompt fragment that scales depth/richness by growth phase
  // without changing which stages run. Appended to every per-stage AI
  // prompt by the wizard orchestrator (Phase 3 wires this in).
  //
  // Generic fallback per phase, plus per-stage overrides where the
  // shape differs meaningfully (e.g. audience personas count).
  function phaseGuidance(level, stage) {
    var lvl = (level || 'new').toLowerCase();
    var key = (stage || '').toLowerCase();

    var generic = {
      'new':         'Brand phase: NEW. Keep output tight and foundational. Single variant per field. Prefer plain language over nuance — this brand is still finding its voice.',
      'growing':    'Brand phase: GROWING. Standard depth. One primary variant per field, plus 1–2 alternates only where they meaningfully diverge. Sharp positioning, no fluff.',
      'established':'Brand phase: ESTABLISHED. Rich, multi-variant output. Where it helps, offer 2–3 alternatives reflecting different strategic emphases. Nuanced positioning. Reference category trends and competitive context.'
    };

    var perStage = {
      'identity': {
        'new':         '\nIdentity rules: one mission, one vision, 3 core values, one tagline candidate.',
        'growing':    '\nIdentity rules: one mission, one vision, 4 values, 2 tagline candidates, 1 positioning statement.',
        'established':'\nIdentity rules: 3 mission alternatives (different strategic emphases), one vision, 4–5 values, 3 tagline candidates, nuanced positioning vs named competitors.'
      },
      'audience': {
        'new':         '\nAudience rules: primary description only. No segments, no personas.',
        'growing':    '\nAudience rules: primary + 2 segments + 1 detailed persona.',
        'established':'\nAudience rules: primary + 3 segments + 2–3 detailed personas covering buyer + user + influencer where distinct.'
      },
      'competitors': {
        'new':         '\nCompetitor rules: 0–2 lite cards (name + one-line positioning). Skip if the brand mentioned none.',
        'growing':    '\nCompetitor rules: 3–4 cards with positioning + strengths + weaknesses.',
        'established':'\nCompetitor rules: 4–5 cards with positioning + strengths + weaknesses + explicit "vs. you" delta. Include adjacent/indirect competitors.'
      },
      'market': {
        'new':         '\nMarket rules: category + one-line positioning only.',
        'growing':    '\nMarket rules: category + positioning + 3 differentiators.',
        'established':'\nMarket rules: category + positioning + 3 differentiators + trends + 2 opportunity gaps.'
      },
      'voice': {
        'new':         '\nVoice rules: primary tone + 3 personality traits + 5 dos/donts.',
        'growing':    '\nVoice rules: primary tone + 5 personality traits + dos/donts + preferred vocabulary + 1 sample paragraph.',
        'established':'\nVoice rules: primary tone + 5 personality traits + tone-by-context (email/social/support/sales/PR) + vocabulary + 2 sample paragraphs (long + short form).'
      },
      'offerings': {
        'new':         '\nOfferings rules: list items the brand mentioned. Skip pricing detail if absent.',
        'growing':    '\nOfferings rules: items + pricing model summary + per-item target audience.',
        'established':'\nOfferings rules: items + pricing model + plans/tiers when discernible + per-item differentiators.'
      }
    };

    var base = generic[lvl] || generic['new'];
    var stageRule = (perStage[key] && perStage[key][lvl]) || '';
    return base + stageRule;
  }

  // ── BRAND SNIPPET ──────────────────────────────────────────────────
  // Build a compact context block to append to prompts. BPW reads from
  // W.acceptedSections via BrandService, not from external Drupal divs.
  function brandSnippet(type) {
    var BrandService = window.BrandService;
    if (!BrandService || !BrandService.isConfigured()) return '';
    var lines = [];
    var id = BrandService.getIdentity();
    var voice = BrandService.getVoice();
    var aud = BrandService.getAudience();
    var mkt = BrandService.getMarket();
    var off = BrandService.getOfferings();

    if (type === 'identity' || type === 'voice' || type === 'audience' || type === 'angles') {
      if (id.mission)        lines.push('Mission: ' + id.mission);
      if (id.vision)         lines.push('Vision: ' + id.vision);
      if (id.brand_archetype)lines.push('Archetype: ' + id.brand_archetype);
      if (voice.primary_tone)lines.push('Voice tone: ' + voice.primary_tone);
    }

    if (type === 'audience' || type === 'market' || type === 'offerings' || type === 'content' || type === 'seo') {
      if (aud.primary_description) lines.push('Audience: ' + aud.primary_description);
    }

    if (type === 'market' || type === 'content' || type === 'seo') {
      if (mkt.category)    lines.push('Market category: ' + mkt.category);
      if (mkt.positioning) lines.push('Positioning: ' + mkt.positioning);
    }

    if (type === 'content' || type === 'seo') {
      if (voice.dos && voice.dos.length)     lines.push('DO: ' + voice.dos.slice(0, 5).join('; '));
      if (voice.donts && voice.donts.length) lines.push("DON'T: " + voice.donts.slice(0, 5).join('; '));
    }

    if (type === 'offerings') {
      if (off.items && off.items.length) {
        lines.push('Offerings: ' + off.items.map(function(o) { return o.name || o.title || o; }).join('; '));
      }
    }

    return lines.length ? '\n\nBrand context:\n' + lines.join('\n') : '';
  }

  // ── RETRY WRAPPER ──────────────────────────────────────────────────
  // Wraps LLMService.callAI so that a parse failure in the onSuccess
  // callback triggers one retry with stricter JSON instructions.
  function callAIWithRetry(prompt, onSuccess, onError, actionId, systemPrompt) {
    var LLMService = window.LLMService;
    var toast = window._bpwToast || function() {};
    if (!LLMService || !LLMService.callAI) {
      if (onError) onError('LLMService unavailable');
      return;
    }
    LLMService.callAI(prompt, function(text) {
      try {
        onSuccess(text);
      } catch (e) {
        console.warn('[BPW-ai] AI response parse failed, retrying with stricter instructions:', e.message);
        var retryPrompt = prompt + '\n\nCRITICAL: Your previous response was not valid JSON. Respond with ONLY a valid JSON object. No markdown, no code fences, no explanations before or after. Just pure JSON.';
        toast('Retrying with stricter instructions...', 'info');
        LLMService.callAI(retryPrompt, function(text2) {
          try {
            onSuccess(text2);
          } catch (e2) {
            console.error('[BPW-ai] AI retry also failed:', e2.message);
            toast('AI response format error: ' + e2.message + '. Try a different model.', 'error');
            if (onError) onError('Parse error after retry: ' + e2.message);
          }
        }, function(err) { if (onError) onError(err); }, systemPrompt);
      }
    }, function(err) { if (onError) onError(err); }, systemPrompt);
  }

  // ── ACTION-BUTTON LOADING STATE ────────────────────────────────────
  // Disables every button matching [data-action="<actionName>"] and
  // swaps its label to a spinner. Returns a restore closure to call
  // once the action finishes (success or failure).
  function aiActionLoading(actionName) {
    var icon = window._bpwIcon || function() { return ''; };
    var $btns = $('[data-action="' + actionName + '"]');
    var origData = [];
    $btns.each(function() {
      origData.push({ el: this, html: $(this).html(), disabled: $(this).prop('disabled') });
      $(this).prop('disabled', true).addClass('bpw-btn-loading').html(icon('spinner fa-spin') + ' Working...');
    });
    return function() {
      for (var i = 0; i < origData.length; i++) {
        $(origData[i].el).prop('disabled', origData[i].disabled).removeClass('bpw-btn-loading').html(origData[i].html);
      }
    };
  }

  window._bpwAIHelpers = {
    parseJSON: parseJSON,
    extractBraceBlock: extractBraceBlock,
    brandSnippet: brandSnippet,
    callAIWithRetry: callAIWithRetry,
    aiActionLoading: aiActionLoading,
    consolidateSeedDump: consolidateSeedDump,
    phaseGuidance: phaseGuidance
  };
})();
