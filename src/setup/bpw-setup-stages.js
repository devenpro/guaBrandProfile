/**
 * @category    setup
 * @purpose     Stage registry for the autopilot. Defines every stage,
 *              its growth-phase + brand-type gate, its AI action ref,
 *              its inline expand-to-edit renderer, and its summary
 *              presenters. The orchestrator consumes this registry to
 *              compute the queue from W.brandLevel + W.brandTypes.
 *
 * @exports     window._bpwSetupStages
 *                = {
 *                    STAGE_REGISTRY: Stage[],
 *                    stagesFor(level, types): string[]   // ordered stage ids
 *                    findStage(id): Stage | null,
 *                    diffStages(fromLevel, toLevel, types): string[]
 *                  }
 *
 * @depends-on  window._bpwState (W.brandLevel, W.brandTypes,
 *              W.acceptedSections, W.generatedSections),
 *              window._bpwConstants.LEVEL_ORDER
 *
 * Replaces buildSteps() in bpw-app.js:434-467. The "merged identity_voice"
 * and "merged audience_offerings" stages preserve the legacy phased
 * behaviour for New/Growing levels; Deep substitutes split stages.
 */
(function() {
  'use strict';

  function _esc(s) {
    return (window._bpwEsc || function(x) {
      if (x === null || x === undefined) return '';
      return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    })(s);
  }

  // Render a flat key value as a short readable line. Used by stage
  // summaryLine implementations that want to show "Mission: ..." etc.
  function _flat(state, key) {
    var gen = (state && state.generatedSections) || {};
    var acc = (state && state.acceptedSections) || {};
    if (gen[key] !== undefined) return gen[key];
    // Fallback: look up nested via simple mapping.
    if (key.indexOf('identity_') === 0) return (acc.identity || {})[key.substring('identity_'.length).replace('pitch', 'elevator_pitch').replace('archetype', 'brand_archetype')];
    if (key.indexOf('voice_') === 0) return (acc.voice || {})[key.substring('voice_'.length).replace('preferred', 'vocabulary.preferred_terms').replace('avoided', 'vocabulary.avoided_terms')];
    return null;
  }

  function _truncate(s, n) {
    if (!s) return '';
    s = String(s);
    return s.length > n ? s.substring(0, n) + '…' : s;
  }

  function _list(state, key, limit) {
    var v = _flat(state, key);
    if (!v) return [];
    if (Array.isArray(v)) return v.slice(0, limit || 3);
    return [String(v)];
  }

  // ── Stage registry ─────────────────────────────────────────────────
  // Each stage:
  //   id            — stable identifier; orchestrator uses for state keys.
  //   label         — sidebar label.
  //   group         — visual grouping (foundation/identity/audience/market/content).
  //   gate.growthPhase — phases this stage runs on.
  //   gate.brandTypes  — optional; ANY-match against W.brandTypes.
  //   dependsOn     — other stage ids that must be done first.
  //   aiActionRef   — window._bpwAIActions[group][fn] path.
  //   summaryLine(state)
  //                 — short status line shown while running.
  //   summary(state)
  //                 — longer recap after stage completes.
  //   expandRenderer(state)
  //                 — placeholder HTML for the row's expand-to-edit panel
  //                   (the per-stage inline editor will replace this in
  //                    Phase 4).
  var STAGE_REGISTRY = [
    {
      id: 'scrape',
      label: 'Read website & basics',
      group: 'foundation',
      gate: { growthPhase: ['new', 'growing', 'deep'] },
      dependsOn: [],
      aiActionRef: 'scrape.run',
      // The scrape stage anchors every later stage. If the AI can't
      // actually fetch the URL it tends to produce generic content,
      // which then poisons identity/voice/audience downstream. Pause
      // here so the user can verify before we burn more API calls.
      needsReview: true,
      summaryLine: function(state) {
        var seed = state && state.seedContext || {};
        return seed.url ? 'Reading ' + seed.url : 'Reading website…';
      },
      summary: function(state) {
        var web = ((state && state.importedAssets) || {}).website || {};
        if (web.status !== 'success') return 'No website data extracted.';
        var ex = web.extracted || {};
        return [
          ex.tagline ? 'Tagline: ' + _truncate(ex.tagline, 60) : '',
          ex.target_audience ? 'Audience: ' + _truncate(ex.target_audience, 60) : '',
          (ex.offerings || []).length ? 'Offerings: ' + ex.offerings.slice(0, 3).join(', ') : ''
        ].filter(Boolean).join(' · ') || 'Website analysed.';
      },
      expandRenderer: function(state) {
        var web = ((state && state.importedAssets) || {}).website || {};
        var ex = web.extracted || {};
        var offerings = (ex.offerings || []).filter(Boolean);
        var themes = (ex.content_themes || []).filter(Boolean);
        var messages = (ex.key_messages || []).filter(Boolean);
        var html = '<div class="bpw-setup-stage-detail">'
          + '<div class="bpw-setup-field"><label>Tagline</label><div class="bpw-setup-readonly">' + _esc(ex.tagline || '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Description</label><div class="bpw-setup-readonly">' + _esc(ex.description || '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Target audience</label><div class="bpw-setup-readonly">' + _esc(ex.target_audience || '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Detected tone</label><div class="bpw-setup-readonly">' + _esc(ex.tone_detected || '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Offerings</label><div class="bpw-setup-readonly">' + _esc(offerings.length ? offerings.join(', ') : '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Key messages</label><div class="bpw-setup-readonly">' + _esc(messages.length ? messages.join(' · ') : '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Content themes</label><div class="bpw-setup-readonly">' + _esc(themes.length ? themes.join(', ') : '—') + '</div></div>'
          + '</div>';
        return html;
      }
    },

    {
      id: 'market',
      label: 'Market',
      group: 'market',
      gate: { growthPhase: ['growing', 'deep'], brandTypes: ['commercial', 'local'] },
      dependsOn: ['scrape'],
      aiActionRef: 'market.run',
      summaryLine: function() { return 'Analysing market category and competitors…'; },
      summary: function(state) {
        var category = _flat(state, 'market_category');
        var comps = _list(state, 'market_competitors', 3);
        return [
          category ? 'Category: ' + _truncate(category, 50) : '',
          comps.length ? 'Top competitors: ' + comps.map(function(c) { return c.name || c; }).filter(Boolean).join(', ') : ''
        ].filter(Boolean).join(' · ') || 'Market analysed.';
      },
      expandRenderer: function(state) {
        return '<div class="bpw-setup-stage-detail">'
          + '<div class="bpw-setup-field"><label>Market category</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'market_category') || '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Positioning</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'market_positioning') || '—') + '</div></div>'
          + '</div>';
      }
    },

    // Merged stage for New/Growing levels: runs mission options first,
    // then full identity + voice once user picks a mission. The action
    // module (identity.runMergedIdentityVoice) handles the phase machine.
    {
      id: 'identity_voice',
      label: 'Identity & voice',
      group: 'identity',
      gate: { growthPhase: ['new', 'growing'] },
      dependsOn: ['scrape'],
      aiActionRef: 'identity.runMergedIdentityVoice',
      summaryLine: function() { return 'Generating mission, voice, and tone…'; },
      summary: function(state) {
        var mission = _flat(state, 'identity_mission');
        var tone = _flat(state, 'voice_tone');
        return [
          mission ? 'Mission: ' + _truncate(mission, 70) : '',
          tone ? 'Voice: ' + _truncate(tone, 70) : ''
        ].filter(Boolean).join(' · ') || 'Identity drafted.';
      },
      expandRenderer: function(state) {
        return '<div class="bpw-setup-stage-detail">'
          + '<div class="bpw-setup-field"><label>Mission</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'identity_mission') || '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Voice tone</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'voice_tone') || '—') + '</div></div>'
          + '</div>';
      }
    },

    // Deep level: split identity from voice.
    {
      id: 'identity',
      label: 'Identity',
      group: 'identity',
      gate: { growthPhase: ['deep'] },
      dependsOn: ['scrape'],
      aiActionRef: 'identity.runIdentity',
      summaryLine: function() { return 'Generating mission, vision, values, archetype…'; },
      summary: function(state) {
        var mission = _flat(state, 'identity_mission');
        var arch = _flat(state, 'identity_archetype');
        return [
          mission ? 'Mission: ' + _truncate(mission, 60) : '',
          arch ? 'Archetype: ' + _truncate(arch, 40) : ''
        ].filter(Boolean).join(' · ') || 'Identity drafted.';
      },
      expandRenderer: function(state) {
        return '<div class="bpw-setup-stage-detail">'
          + '<div class="bpw-setup-field"><label>Mission</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'identity_mission') || '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Vision</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'identity_vision') || '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Archetype</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'identity_archetype') || '—') + '</div></div>'
          + '</div>';
      }
    },

    {
      id: 'voice',
      label: 'Voice & messaging',
      group: 'identity',
      gate: { growthPhase: ['deep'] },
      dependsOn: ['identity'],
      aiActionRef: 'voice.run',
      summaryLine: function() { return 'Generating tone, vocabulary, messaging…'; },
      summary: function(state) {
        var tone = _flat(state, 'voice_tone');
        var prim = _flat(state, 'messaging_primary');
        return [
          tone ? 'Voice: ' + _truncate(tone, 60) : '',
          prim ? 'Primary message: ' + _truncate(prim, 60) : ''
        ].filter(Boolean).join(' · ') || 'Voice drafted.';
      },
      expandRenderer: function(state) {
        return '<div class="bpw-setup-stage-detail">'
          + '<div class="bpw-setup-field"><label>Tone</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'voice_tone') || '—') + '</div></div>'
          + '<div class="bpw-setup-field"><label>Primary message</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'messaging_primary') || '—') + '</div></div>'
          + '</div>';
      }
    },

    {
      id: 'audience_offerings',
      label: 'Audience & offerings',
      group: 'audience',
      gate: { growthPhase: ['new', 'growing'] },
      dependsOn: ['identity_voice'],
      aiActionRef: 'audience.runMergedAudienceOfferings',
      summaryLine: function() { return 'Profiling audience and structuring offerings…'; },
      summary: function(state) {
        var aud = _flat(state, 'audience_primary');
        var off = _list(state, 'offerings_items', 3);
        return [
          aud ? 'Audience: ' + _truncate(aud, 60) : '',
          off.length ? 'Offerings: ' + off.map(function(o) { return o.name || o; }).filter(Boolean).join(', ') : ''
        ].filter(Boolean).join(' · ') || 'Audience drafted.';
      },
      expandRenderer: function(state) {
        return '<div class="bpw-setup-stage-detail">'
          + '<div class="bpw-setup-field"><label>Primary audience</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'audience_primary') || '—') + '</div></div>'
          + '</div>';
      }
    },

    {
      id: 'audience',
      label: 'Audience',
      group: 'audience',
      gate: { growthPhase: ['deep'] },
      dependsOn: ['voice'],
      aiActionRef: 'audience.run',
      summaryLine: function() { return 'Profiling audience and personas…'; },
      summary: function(state) {
        var aud = _flat(state, 'audience_primary');
        var personas = _list(state, 'audience_personas', 3);
        return [
          aud ? 'Audience: ' + _truncate(aud, 60) : '',
          personas.length ? personas.length + ' personas' : ''
        ].filter(Boolean).join(' · ') || 'Audience drafted.';
      },
      expandRenderer: function(state) {
        return '<div class="bpw-setup-stage-detail">'
          + '<div class="bpw-setup-field"><label>Primary audience</label><div class="bpw-setup-readonly">' + _esc(_flat(state, 'audience_primary') || '—') + '</div></div>'
          + '</div>';
      }
    },

    {
      id: 'offerings',
      label: 'Offerings',
      group: 'audience',
      gate: { growthPhase: ['deep'], brandTypes: ['commercial', 'local', 'nonprofit'] },
      dependsOn: ['audience'],
      aiActionRef: 'offerings.run',
      summaryLine: function() { return 'Structuring offerings…'; },
      summary: function(state) {
        var items = _list(state, 'offerings_items', 4);
        return items.length
          ? items.map(function(o) { return o.name || o; }).filter(Boolean).join(', ')
          : 'Offerings drafted.';
      },
      expandRenderer: function(state) {
        var items = _list(state, 'offerings_items', 10) || [];
        if (!items.length) return '<div class="bpw-setup-stage-detail"><div class="bpw-setup-readonly">No offerings yet.</div></div>';
        var rows = items.map(function(o) { return '<li><strong>' + _esc(o.name || '') + '</strong>' + (o.description ? ' — ' + _esc(o.description) : '') + '</li>'; }).join('');
        return '<div class="bpw-setup-stage-detail"><ul class="bpw-setup-list">' + rows + '</ul></div>';
      }
    },

    {
      id: 'content',
      label: 'Content strategy',
      group: 'content',
      gate: { growthPhase: ['new', 'growing', 'deep'], brandTypes: ['creator', 'commercial'] },
      dependsOn: [],   // Soft dependency — runs after audience but can stand alone.
      aiActionRef: 'content.run',
      summaryLine: function() { return 'Building pillars, channels, SEO seeds…'; },
      summary: function(state) {
        var pillars = _list(state, 'content_pillars', 4);
        var channels = _list(state, 'content_channels', 4);
        return [
          pillars.length ? pillars.length + ' pillars' : '',
          channels.length ? channels.length + ' channels' : ''
        ].filter(Boolean).join(' · ') || 'Content strategy drafted.';
      },
      expandRenderer: function(state) {
        return '<div class="bpw-setup-stage-detail">'
          + '<div class="bpw-setup-field"><label>Pillars</label><div class="bpw-setup-readonly">' + _esc(JSON.stringify(_flat(state, 'content_pillars') || [])) + '</div></div>'
          + '</div>';
      }
    }
  ];

  // ── Queue computation ──────────────────────────────────────────────
  function _gateMatches(stage, level, types) {
    if (stage.gate.growthPhase.indexOf(level) === -1) return false;
    if (!stage.gate.brandTypes) return true;
    for (var i = 0; i < stage.gate.brandTypes.length; i++) {
      if (types.indexOf(stage.gate.brandTypes[i]) !== -1) return true;
    }
    return false;
  }

  function stagesFor(level, types) {
    types = types || [];
    var queue = [];
    for (var i = 0; i < STAGE_REGISTRY.length; i++) {
      if (_gateMatches(STAGE_REGISTRY[i], level, types)) queue.push(STAGE_REGISTRY[i].id);
    }
    return queue;
  }

  function findStage(id) {
    for (var i = 0; i < STAGE_REGISTRY.length; i++) {
      if (STAGE_REGISTRY[i].id === id) return STAGE_REGISTRY[i];
    }
    return null;
  }

  // Stages that exist at `toLevel` but not at `fromLevel`. Includes the
  // merged→split case: going growing → deep, the merged identity_voice
  // stage was run, but Deep needs separate identity AND voice prompts.
  // Same for audience_offerings.
  function diffStages(fromLevel, toLevel, types) {
    var oldQueue = stagesFor(fromLevel, types);
    var newQueue = stagesFor(toLevel, types);
    var delta = [];
    for (var i = 0; i < newQueue.length; i++) {
      var id = newQueue[i];
      if (oldQueue.indexOf(id) !== -1) continue;
      delta.push(id);
    }
    // Merged→split: if the old queue had a merged stage that's gone in
    // the new queue, surface the split stages as deltas even though the
    // merged ran (they generate different field shapes at Deep level).
    if (oldQueue.indexOf('identity_voice') !== -1 && newQueue.indexOf('identity_voice') === -1) {
      if (newQueue.indexOf('identity') !== -1 && delta.indexOf('identity') === -1) delta.push('identity');
      if (newQueue.indexOf('voice') !== -1    && delta.indexOf('voice') === -1)    delta.push('voice');
    }
    if (oldQueue.indexOf('audience_offerings') !== -1 && newQueue.indexOf('audience_offerings') === -1) {
      if (newQueue.indexOf('audience') !== -1  && delta.indexOf('audience') === -1)  delta.push('audience');
      if (newQueue.indexOf('offerings') !== -1 && delta.indexOf('offerings') === -1) delta.push('offerings');
    }
    return delta;
  }

  window._bpwSetupStages = {
    STAGE_REGISTRY: STAGE_REGISTRY,
    stagesFor: stagesFor,
    findStage: findStage,
    diffStages: diffStages
  };
})();
