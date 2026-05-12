/**
 * Brand Profile Wizard v1.0 — bpw-part2a.js
 *
 * AI execution layer: prompt templates, step runners,
 * URL scraping, inline editing, redo with guidance,
 * voice preview, and v2-to-v1 migration bridge.
 *
 * Polls for Part 1 (bpw-app.js) initialization, then
 * imports globals and wires up all AI interactions.
 *
 * Sections:
 *  1. Init & Imports
 *  2. Prompt Templates
 *  3. Step Runners (AI orchestration per step)
 *  4. URL Scraping
 *  5. Inline Section Editing
 *  6. Redo with Guidance
 *  7. Accept All / Redo All
 *  8. Voice Preview Generator
 *  9. v2 → v1 Migration Bridge
 * 10. Event Wiring
 * 11. Exports
 *
 * @version 1.0.0
 */
import { migrateV2toV1 } from '../core/migration.js';
import { W } from '../core/state.js';
import { BRAND_TYPES } from '../core/constants.js';
import { has, isLevel } from '../core/brand-helpers.js';
import { esc } from '../utils/helpers.js';
import { icon } from '../utils/dom.js';

(function($, Drupal) {
  'use strict';

  // ============================================================
  // SECTION 1: INIT & IMPORTS
  // ============================================================

  // W, BRAND_TYPES, has, isLevel, esc, icon are imported at file top.
  // The vars below are still pulled from window._bpw* in initPart2A()
  // because their producers (bpw-app.js §6–9, §23–24, etc.) have not
  // yet been extracted into modules.
  var LLMService, render, goStep, goNext, toast, buildSteps;
  var autoSave, syncToTextarea, buildFinalProfile;
  var parseAIResponse, setSectionState, acceptSection, rejectSection;
  var renderAISection, buildAIContext, getLangInstruction;

  var LOG = '[BPW-2A]';
  var _pollCount = 0;
  var _pollTimer = setInterval(function() {
    _pollCount++;

    // Check if Part 1 initialized
    if (window._bpwState && window._bpwState.initialized) {
      clearInterval(_pollTimer);
      initPart2A();
      return;
    }

    // Diagnostic logging every 5 seconds
    if (_pollCount % 50 === 0) {
      console.log(LOG, 'Waiting for Part 1...', {
        _bpwState_exists: !!window._bpwState,
        initialized: window._bpwState ? window._bpwState.initialized : 'N/A',
        _initializing: window._bpwState ? window._bpwState._initializing : 'N/A',
        pollCount: _pollCount
      });
    }

    // Timeout after 30 seconds
    if (_pollCount > 300) {
      clearInterval(_pollTimer);
      if (window._bpwState) {
        console.warn(LOG, 'Part 1 loaded but did not initialize. The wizard may not be needed on this page.',
          'initialized:', window._bpwState.initialized,
          '_initializing:', window._bpwState._initializing);
      } else {
        console.warn(LOG, 'Part 1 (bpw-app.js) was not found. Is it loaded via Asset Injector?');
      }
    }
  }, 100);

  function initPart2A() {
    console.log(LOG, 'Initializing...');

    LLMService = window._bpwLLMService;
    render = window._bpwRender;
    goStep = window._bpwGoStep;
    toast = window._bpwToast;
    buildSteps = window._bpwBuildSteps;
    goNext = function() { $('[data-action="go-next"]').first().trigger('click'); };

    autoSave = window._bpwAutoSave || function() {};
    syncToTextarea = window._bpwSyncToTextarea || function() {};
    buildFinalProfile = window._bpwBuildFinalProfile || function() { return {}; };
    parseAIResponse = window._bpwParseAIResponse || function(t) { try { return { success: true, data: JSON.parse(t) }; } catch (e) { return { success: false, rawText: t }; } };
    setSectionState = window._bpwSetSectionState || function(k, s) { W.sectionStates[k] = s; };
    acceptSection = window._bpwAcceptSection || function() {};
    rejectSection = window._bpwRejectSection || function() {};
    renderAISection = window._bpwRenderAISection || function() { return ''; };
    buildAIContext = window._bpwBuildAIContext || function() { return {}; };
    getLangInstruction = window._bpwGetLangInstruction || function() { return ''; };

    setupPart2AEvents();

    console.log(LOG, 'Initialized. AI:', LLMService && LLMService.isConfigured() ? 'ready' : 'not configured');
  }

  // ============================================================
  // SECTION 2: PROMPT TEMPLATES
  // ============================================================

  function _typeDesc() {
    return W.brandTypes.map(function(t) { return (BRAND_TYPES[t] || {}).label || t; }).join(' + ');
  }

  function _langSuffix() {
    return getLangInstruction();
  }

  function _contextBlock() {
    var ctx = buildAIContext();

    var parts = [];
    parts.push('Brand: ' + (ctx.seed.name || 'Unknown'));
    parts.push('Type: ' + _typeDesc());
    parts.push('Level: ' + (ctx.brand_level || 'new'));
    if (ctx.seed.description) parts.push('Description: ' + ctx.seed.description);
    if (ctx.seed.industry) parts.push('Industry: ' + ctx.seed.industry);
    if (ctx.seed.business_model) parts.push('Business model: ' + ctx.seed.business_model);
    if (ctx.seed.website_url) parts.push('Website: ' + ctx.seed.website_url);
    if (ctx.seed.primary_platform) parts.push('Primary platform: ' + ctx.seed.primary_platform);
    if (ctx.seed.content_niche) parts.push('Content niche: ' + ctx.seed.content_niche);
    if (ctx.seed.cause_area) parts.push('Cause area: ' + ctx.seed.cause_area);

    // Explicitly include scraped data if available
    var web = ctx.imported && ctx.imported.website;
    if (web && web.status === 'success' && web.extracted) {
      var ex = web.extracted;
      parts.push('\n--- Website Analysis (scraped from ' + (web.url || 'website') + ') ---');
      if (ex.tagline) parts.push('Tagline found: ' + ex.tagline);
      if (ex.description) parts.push('Site description: ' + ex.description);
      if (ex.offerings && ex.offerings.length) parts.push('Offerings on site: ' + ex.offerings.join(', '));
      if (ex.target_audience) parts.push('Target audience (from site): ' + ex.target_audience);
      if (ex.tone_detected) parts.push('Tone detected: ' + ex.tone_detected);
      if (ex.key_messages && ex.key_messages.length) parts.push('Key messages: ' + ex.key_messages.join('; '));
      if (ex.content_themes && ex.content_themes.length) parts.push('Content themes: ' + ex.content_themes.join(', '));
    }

    // Explicitly include discovery answers
    var disc = ctx.discovery;
    if (disc && Object.keys(disc).length) {
      parts.push('\n--- User Discovery Answers ---');
      for (var qid in disc) {
        if (disc.hasOwnProperty(qid)) {
          var a = disc[qid];
          if (a.text) parts.push(qid + ': ' + a.text);
          if (a.detail) parts.push(qid + ' detail: ' + a.detail);
        }
      }
    }

    // Include known competitors
    if (ctx.seed._knownCompetitors && ctx.seed._knownCompetitors.length) {
      parts.push('\nKnown competitors: ' + ctx.seed._knownCompetitors.filter(Boolean).join(', '));
    }
    if (ctx.seed._researchFocus) {
      parts.push('Research focus: ' + ctx.seed._researchFocus);
    }

    // Include already accepted sections for cross-reference
    if (ctx.accepted && Object.keys(ctx.accepted).length) {
      parts.push('\n--- Already Defined Brand Elements ---');
      var acc = ctx.accepted;
      if (acc.identity && acc.identity.mission) parts.push('Mission: ' + acc.identity.mission);
      if (acc.identity && acc.identity.vision) parts.push('Vision: ' + acc.identity.vision);
      if (acc.voice && acc.voice.primary_tone) parts.push('Voice tone: ' + acc.voice.primary_tone);
      if (acc.messaging && acc.messaging.primary_message) parts.push('Primary message: ' + acc.messaging.primary_message);
      if (acc.market && acc.market.positioning) parts.push('Positioning: ' + acc.market.positioning);
    }

    return '\n\nBrand context:\n' + parts.join('\n');
  }

  function _jsonOnly() {
    return '\n\nRESPOND WITH VALID JSON ONLY. No markdown, no explanation, no preamble. Just the JSON object.';
  }

  var PROMPTS = {

    scrape: function(url, platformType) {
      var socialHint = platformType === 'website'
        ? '\n\nIMPORTANT: Also extract ALL social media profile links you can find on this website (check header, footer, sidebar, contact page, and meta/og tags). Common patterns: youtube.com/@ or /channel/, instagram.com/, linkedin.com/company/ or /in/, twitter.com/ or x.com/, facebook.com/, tiktok.com/@, plus any Google Business profile links.'
        : '';
      var socialSchema = platformType === 'website'
        ? ',\n  "social_profiles": [\n    {"platform": "youtube|instagram|linkedin|twitter_x|facebook|tiktok|google_business|other", "url": "full profile URL", "handle": "@handle or name"}\n  ]'
        : '';
      return {
        system: 'You are a brand analyst with web access. Analyze the given URL and extract brand-relevant information. Return a structured JSON analysis.' + _langSuffix(),
        user: 'Analyze this ' + platformType + ' URL and extract all brand information:\n' + url + socialHint + '\n\nReturn ONLY valid JSON:\n{\n  "tagline": "",\n  "description": "",\n  "offerings": [""],\n  "target_audience": "",\n  "tone_detected": "",\n  "key_messages": [""],\n  "content_themes": [""],\n  "contact_info": {}' + socialSchema + '\n}' + _jsonOnly()
      };
    },

    market: function() {
      var depth = isLevel('deep') ? 'comprehensive' : 'brief';
      return {
        system: 'You are an expert market research analyst. Conduct ' + depth + ' market analysis for a ' + _typeDesc() + ' brand.' + _langSuffix(),
        user: 'Based on this brand context, generate a market analysis.' + _contextBlock() + '\n\nReturn ONLY valid JSON:\n{\n  "market_category": "string — the market/industry category",\n  "market_positioning": "string — 2-3 sentence positioning statement",\n  "market_competitors": [\n    {"name":"","description":"","url":"","strengths":[""],"weaknesses":[""],"comparison":""}\n  ],\n  "market_differentiators": [\n    {"point":"","evidence":""}\n  ]' + (isLevel('deep') ? ',\n  "market_trends": ["string"],\n  "market_opportunities": ["string"]' : '') + '\n}' + _jsonOnly()
      };
    },

    identity_mission_only: function() {
      return {
        system: 'You are an expert brand strategist. Generate 3 compelling, distinct mission statement options for a ' + _typeDesc() + ' brand. Each should capture a different strategic angle or emphasis.' + _langSuffix(),
        user: 'Generate 3 mission statement options for this brand. Each should be unique in angle, tone, or strategic emphasis.' + _contextBlock() + '\n\nReturn ONLY valid JSON:\n{\n  "identity_mission_options": ["mission option 1 — clear and concise", "mission option 2 — different angle", "mission option 3 — different emphasis"]\n}' + _jsonOnly()
      };
    },

    identity: function() {
      // Check if user has already selected a mission
      var selectedMission = '';
      if (W.sectionStates.identity_mission === 'accepted' && W.acceptedSections.identity && W.acceptedSections.identity.mission) {
        selectedMission = W.acceptedSections.identity.mission;
      } else if (W.generatedSections.identity_mission) {
        selectedMission = W.generatedSections.identity_mission;
      }

      var missionNote = selectedMission
        ? '\n\nIMPORTANT: The user has already chosen this mission statement: "' + selectedMission + '"\nAll identity elements MUST align with and build upon this chosen mission. Do NOT change the mission.'
        : '';

      return {
        system: 'You are an expert brand strategist. Create brand identity elements for a ' + _typeDesc() + ' brand.' + (selectedMission ? ' The mission is already decided — build everything else around it.' : ' Generate multiple alternatives for mission so the user can choose.') + _langSuffix(),
        user: 'Generate brand identity elements.' + missionNote + _contextBlock() + '\n\nReturn ONLY valid JSON:\n{' + (selectedMission ? '' : '\n  "identity_mission_options": ["mission option 1", "mission option 2", "mission option 3"],\n  "identity_mission": "the recommended mission statement",') + '\n  "identity_vision": "vision statement aligned with the mission",\n  "identity_values": [\n    {"value":"","description":""}\n  ],\n  "identity_archetype": "string — one of the 12 brand archetypes with brief explanation",\n  "identity_pitch": "30-second elevator pitch"\n}' + _jsonOnly()
      };
    },

    voice: function() {
      return {
        system: 'You are an expert brand voice strategist. Define the complete voice, tone, and messaging framework for a ' + _typeDesc() + ' brand.' + _langSuffix(),
        user: 'Generate voice and messaging framework.' + _contextBlock() + '\n\nReturn ONLY valid JSON:\n{\n  "voice_tone": "primary tone description — 2-3 sentences",\n  "voice_personality": ["trait1", "trait2", "trait3", "trait4", "trait5"],\n  "voice_dos": ["rule1", "rule2", "rule3", "rule4", "rule5"],\n  "voice_donts": ["rule1", "rule2", "rule3", "rule4", "rule5"],\n  "voice_preferred": ["term1", "term2", "term3"],\n  "voice_avoided": ["term1", "term2", "term3"],\n  "messaging_primary": "primary brand message — one powerful sentence",\n  "messaging_supporting": ["supporting message 1", "supporting message 2", "supporting message 3"],\n  "messaging_headlines": [\n    {"context":"landing page","headline":""},\n    {"context":"social media bio","headline":""},\n    {"context":"email subject","headline":""}\n  ],\n  "voice_sample": "A 3-4 sentence sample text written IN the brand voice — a product announcement or content piece"\n}' + _jsonOnly()
      };
    },

    audience: function() {
      var personaCount = isLevel('deep') ? 3 : isLevel('growing') ? 2 : 0;
      return {
        system: 'You are an expert audience researcher. Profile the target audience for a ' + _typeDesc() + ' brand.' + _langSuffix(),
        user: 'Generate audience profile.' + _contextBlock() + '\n\nReturn ONLY valid JSON:\n{\n  "audience_primary": "2-3 sentence primary audience description",\n  "audience_segments": [\n    {"name":"","description":"","pain_points":[""],"goals":[""],"channels":[""]}\n  ]' + (personaCount > 0 ? ',\n  "audience_personas": [\n    {"name":"","role":"","age":"","story":"","pain_points":[""],"goals":[""],"decision_criteria":[""],"journey":""}\n  ]' : '') + '\n}\n\nGenerate 2-3 segments.' + (personaCount > 0 ? ' Generate ' + personaCount + ' detailed personas.' : '') + _jsonOnly()
      };
    },

    offerings: function() {
      var offeringsType = has('creator') ? 'content formats and digital products' : has('nonprofit') ? 'programs and services' : has('local') ? 'services' : 'products and services';
      return {
        system: 'You are a business strategist. Structure the ' + offeringsType + ' for a ' + _typeDesc() + ' brand.' + _langSuffix(),
        user: 'Generate offerings profile.' + _contextBlock() + '\n\nReturn ONLY valid JSON:\n{\n  "offerings_items": [\n    {"name":"","category":"","description":"","features":[""],"benefits":[""],"target_audience":"","status":"active"}\n  ]' + (has('creator') ? ',\n  "offerings_content": "description of content formats and publishing approach",\n  "offerings_revenue": [\n    {"stream":"","status":"active","notes":""}\n  ]' : '') + (has('commercial') ? ',\n  "offerings_pricing": "brief pricing model description"' : '') + (has('nonprofit') ? ',\n  "offerings_programs": [\n    {"name":"","category":"","description":"","features":[""],"target_audience":"","status":"active"}\n  ]' : '') + '\n}\n\nGenerate 3-6 offerings based on available context.' + _jsonOnly()
      };
    },

    content: function() {
      return {
        system: 'You are a content strategist. Build a content and channel strategy for a ' + _typeDesc() + ' brand.' + _langSuffix(),
        user: 'Generate content strategy.' + _contextBlock() + '\n\nReturn ONLY valid JSON:\n{\n  "content_pillars": [\n    {"pillar":"","description":"","topics":[""]}\n  ],\n  "content_channels": [\n    {"channel":"","purpose":"","frequency":"","format":""}\n  ],\n  "content_seo": ["keyword1", "keyword2", "keyword3"],\n  "content_hashtags": ["#hashtag1", "#hashtag2"]\n}\n\nGenerate 3-5 pillars, 3-5 channels, 8-12 SEO keywords, and 5-8 hashtags.' + _jsonOnly()
      };
    },

    voicePreview: function(format) {
      var formatDesc = {
        tweet: 'a tweet (max 280 characters)',
        email: 'an email introduction paragraph',
        video: 'a YouTube video opening script (first 30 seconds)',
        review: 'a reply to a positive customer review',
        blog: 'a blog post opening paragraph',
        custom: 'a short content piece'
      };
      return {
        system: 'You are a brand copywriter. Write content in the exact voice and tone defined for this brand. Match the personality, vocabulary, and style rules precisely.' + _langSuffix(),
        user: 'Write ' + (formatDesc[format] || formatDesc.custom) + ' for this brand.' + _contextBlock() + '\n\nReturn ONLY the text content. No JSON wrapper, no quotes, no explanation. Just the raw text in brand voice.'
      };
    }
  };

  // ============================================================
  // SECTION 3: STEP RUNNERS
  // ============================================================

  // Map current wizard step to one or more AI prompt keys
  function _getAIKeysForStep(stepKey) {
    // Phased identity: only run mission prompt if we haven't picked a mission yet
    if (stepKey === 'identity' || stepKey === 'identity_voice') {
      if (W._identityPhase === 'initial' || W._identityPhase === 'mission_options') {
        return ['identity_mission_only'];
      }
      if (W._identityPhase === 'mission_selected') {
        var keys = ['identity'];
        if (stepKey === 'identity_voice') keys.push('voice');
        return keys;
      }
      // full_complete or full_generating — regenerate all
      if (stepKey === 'identity_voice') return ['identity', 'voice'];
      return ['identity'];
    }

    // Phased audience: only run audience if offerings not yet needed
    if (stepKey === 'audience' || stepKey === 'audience_offerings') {
      if (W._audiencePhase === 'initial' || W._audiencePhase === 'audience_generated') {
        return ['audience'];
      }
      if (stepKey === 'audience_offerings') return ['audience', 'offerings'];
      return ['audience'];
    }

    // Offerings-only trigger (from the separate "Generate Offerings" button)
    if (stepKey === 'offerings_only') return ['offerings'];

    return [stepKey];
  }

  function runStepAI(stepKey) {
    if (!LLMService || !LLMService.isConfigured()) {
      toast('No AI providers configured. Set up AI in the Basics step.', 'warning');
      return;
    }
    if (W.isAIProcessing) {
      toast('AI is still processing. Please wait.', 'info');
      return;
    }

    var aiKeys = _getAIKeysForStep(stepKey);
    console.log(LOG, 'Running AI for step:', stepKey, '→ prompts:', aiKeys.join(', '));

    var allSectionKeys = [];
    for (var k = 0; k < aiKeys.length; k++) {
      var skeys = getSectionKeysForStep(aiKeys[k]);
      for (var s = 0; s < skeys.length; s++) {
        if (allSectionKeys.indexOf(skeys[s]) === -1) allSectionKeys.push(skeys[s]);
      }
    }

    // G8: Lock processing state BEFORE any calls
    W.isAIProcessing = true;
    W._aiProgress = { total: aiKeys.length, current: 0, stepKey: stepKey, currentKey: '' };

    for (var i = 0; i < allSectionKeys.length; i++) {
      setSectionState(allSectionKeys[i], 'loading');
    }
    render();

    _runPromptsSequential(aiKeys, 0, allSectionKeys, stepKey);
  }

  function _runPromptsSequential(keys, index, allSectionKeys, originalStepKey) {
    if (index >= keys.length) {
      // G8: Unlock processing when ALL prompts done
      W.isAIProcessing = false;
      W._aiProgress = null;

      // Phase transition after AI completes
      _handlePhaseTransition(originalStepKey, keys);

      autoSave();
      render();
      return;
    }

    // G10: Update progress for UI
    W._aiProgress.current = index + 1;
    W._aiProgress.currentKey = keys[index];

    var key = keys[index];
    var promptFn = PROMPTS[key];
    if (!promptFn) {
      console.warn(LOG, 'No prompt for:', key, '— skipping');
      _runPromptsSequential(keys, index + 1, allSectionKeys, originalStepKey);
      return;
    }

    var prompt = promptFn();
    console.log(LOG, 'AI call', (index + 1) + '/' + keys.length, ':', key);

    LLMService.callAI(prompt.user, function(rawText) {
      console.log(LOG, 'AI response for', key, '— length:', rawText.length);
      var parsed = parseAIResponse(rawText);

      if (parsed.success) {
        var data = parsed.data;
        for (var k in data) {
          if (data.hasOwnProperty(k)) {
            W.generatedSections[k] = data[k];
            setSectionState(k, 'generated');
          }
        }
        toast('Generated: ' + key + ' (' + Object.keys(data).length + ' sections)', 'success');
      } else {
        console.warn(LOG, 'Parse failed for', key, ':', parsed.error);
        var skeys = getSectionKeysForStep(key);
        for (var j = 0; j < skeys.length; j++) {
          W.generatedSections[skeys[j]] = parsed.rawText || '';
          setSectionState(skeys[j], 'generated');
        }
        toast(key + ': AI output needs review', 'warning');
      }

      render();
      // Continue to next prompt
      _runPromptsSequential(keys, index + 1, allSectionKeys, originalStepKey);

    }, function(err) {
      console.error(LOG, 'AI error for', key, ':', err);
      toast('AI error (' + key + '): ' + err, 'error');
      // Mark remaining sections as pending
      var skeys = getSectionKeysForStep(key);
      for (var m = 0; m < skeys.length; m++) {
        setSectionState(skeys[m], 'pending');
      }
      render();
      // Still continue to next prompt
      _runPromptsSequential(keys, index + 1, allSectionKeys, originalStepKey);

    }, prompt.system);
  }

  // Phase transitions after AI generation completes
  function _handlePhaseTransition(originalStepKey, keysRun) {
    if (!originalStepKey) return;

    var isIdentityStep = originalStepKey === 'identity' || originalStepKey === 'identity_voice';
    var isAudienceStep = originalStepKey === 'audience' || originalStepKey === 'audience_offerings';

    // Identity phase transitions
    if (isIdentityStep) {
      if (keysRun.indexOf('identity_mission_only') !== -1 && keysRun.indexOf('identity') === -1) {
        // Mission-only prompt completed
        W._identityPhase = 'mission_options';
        console.log(LOG, 'Identity phase → mission_options');
      } else if (keysRun.indexOf('identity') !== -1) {
        // Full identity prompt completed
        W._identityPhase = 'full_complete';
        console.log(LOG, 'Identity phase → full_complete');
      }
    }

    // Audience phase transitions
    if (isAudienceStep || originalStepKey === 'offerings_only') {
      if (keysRun.indexOf('audience') !== -1 && keysRun.indexOf('offerings') === -1) {
        // Audience-only completed
        W._audiencePhase = 'audience_generated';
        console.log(LOG, 'Audience phase → audience_generated');
      }
      if (keysRun.indexOf('offerings') !== -1) {
        W._audiencePhase = 'offerings_generated';
        console.log(LOG, 'Audience phase → offerings_generated');
      }
    }
  }

  function getSectionKeysForStep(stepKey) {
    var map = {
      // Individual step keys
      market: ['market_category', 'market_positioning', 'market_competitors', 'market_differentiators', 'market_trends', 'market_opportunities'],
      identity_mission_only: ['identity_mission_options'],
      identity: ['identity_mission_options', 'identity_mission', 'identity_vision', 'identity_values', 'identity_archetype', 'identity_pitch'],
      voice: ['voice_tone', 'voice_personality', 'voice_dos', 'voice_donts', 'voice_preferred', 'voice_avoided', 'messaging_primary', 'messaging_supporting', 'messaging_headlines', 'voice_sample'],
      audience: ['audience_primary', 'audience_segments', 'audience_personas'],
      offerings: ['offerings_items', 'offerings_content', 'offerings_revenue', 'offerings_pricing', 'offerings_programs'],
      content: ['content_pillars', 'content_channels', 'content_seo', 'content_hashtags']
    };

    // Merged step keys — combine constituent parts
    map.identity_voice = [].concat(map.identity, map.voice);
    map.audience_offerings = [].concat(map.audience, map.offerings);

    return map[stepKey] || [];
  }

  // ============================================================
  // SECTION 4: URL SCRAPING
  // ============================================================

  function scrapeURL(url, platformType, callback) {
    if (!url || !url.trim()) {
      toast('Enter a URL to analyze', 'warning');
      return;
    }
    if (!LLMService || !LLMService.isConfigured()) {
      toast('No AI providers configured for URL analysis.', 'warning');
      return;
    }

    console.log(LOG, 'Scraping URL:', url, 'type:', platformType);
    var prompt = PROMPTS.scrape(url, platformType);

    LLMService.callAI(prompt.user, function(rawText) {
      var parsed = parseAIResponse(rawText);
      if (parsed.success) {
        console.log(LOG, 'Scrape successful:', Object.keys(parsed.data).length, 'fields');
        if (callback) callback({ status: 'success', url: url, extracted: parsed.data, analyzed_at: new Date().toISOString() });
      } else {
        console.warn(LOG, 'Scrape parse failed');
        if (callback) callback({ status: 'partial', url: url, extracted: { raw_text: parsed.rawText }, analyzed_at: new Date().toISOString() });
      }
    }, function(err) {
      console.error(LOG, 'Scrape error:', err);
      if (callback) callback({ status: 'failed', url: url, error: err });
      toast('URL analysis failed: ' + err, 'error');
    }, prompt.system);
  }

  // Detect platform from URL pattern
  function _detectPlatformFromUrl(url) {
    if (!url) return 'other';
    var u = url.toLowerCase();
    if (u.indexOf('youtube.com') !== -1 || u.indexOf('youtu.be') !== -1) return 'youtube';
    if (u.indexOf('instagram.com') !== -1) return 'instagram';
    if (u.indexOf('linkedin.com') !== -1) return 'linkedin';
    if (u.indexOf('twitter.com') !== -1 || u.indexOf('x.com') !== -1) return 'twitter_x';
    if (u.indexOf('facebook.com') !== -1 || u.indexOf('fb.com') !== -1) return 'facebook';
    if (u.indexOf('tiktok.com') !== -1) return 'tiktok';
    if (u.indexOf('google.com/maps') !== -1 || u.indexOf('business.google') !== -1 || u.indexOf('g.page') !== -1) return 'google_business';
    return 'other';
  }

  // Auto-populate social profile rows from scrape results
  function _autoPopulateSocialProfiles(detectedProfiles) {
    if (!detectedProfiles || !Array.isArray(detectedProfiles) || !detectedProfiles.length) return;
    W.importedAssets.social_profiles = W.importedAssets.social_profiles || [];

    var existingUrls = {};
    for (var i = 0; i < W.importedAssets.social_profiles.length; i++) {
      var sp = W.importedAssets.social_profiles[i];
      if (sp && sp.url) existingUrls[sp.url.toLowerCase().replace(/\/+$/, '')] = true;
    }

    var added = 0;
    for (var j = 0; j < detectedProfiles.length; j++) {
      var dp = detectedProfiles[j];
      if (!dp || !dp.url) continue;
      var normalizedUrl = dp.url.toLowerCase().replace(/\/+$/, '');
      if (existingUrls[normalizedUrl]) continue;

      var platform = dp.platform ? dp.platform.toLowerCase().replace(/[\s\/]/g, '_') : _detectPlatformFromUrl(dp.url);
      // Normalize platform names from LLM to our IDs
      if (platform === 'twitter' || platform === 'x') platform = 'twitter_x';
      if (platform === 'google_business_profile' || platform === 'google') platform = 'google_business';

      W.importedAssets.social_profiles.push({
        id: 'sp_' + Date.now() + '_' + j,
        platform: platform,
        url: dp.url,
        handle: dp.handle || '',
        status: 'detected'
      });
      existingUrls[normalizedUrl] = true;
      added++;
    }

    if (added > 0) {
      W._socialRows = Math.max(W._socialRows || 0, W.importedAssets.social_profiles.length);
      console.log(LOG, 'Auto-populated ' + added + ' social profiles from website scrape');
    }
  }

  function handleWebsiteScrape() {
    var url = $('[data-field="import-website-url"]').val();
    if (!url || !url.trim()) { toast('Enter a website URL', 'warning'); return; }

    W.importedAssets.website = { url: url, status: 'loading' };
    render();

    scrapeURL(url, 'website', function(result) {
      W.importedAssets.website = result;

      // Auto-populate social profiles from detected links
      if (result.status === 'success' && result.extracted && result.extracted.social_profiles) {
        _autoPopulateSocialProfiles(result.extracted.social_profiles);
      }

      autoSave();
      render();
      if (result.status === 'success') {
        var socialCount = (result.extracted && result.extracted.social_profiles) ? result.extracted.social_profiles.length : 0;
        var msg = 'Website analyzed successfully';
        if (socialCount > 0) msg += ' \u2014 found ' + socialCount + ' social profile' + (socialCount > 1 ? 's' : '');
        toast(msg, 'success');
      }
    });
  }

  function handleSocialScrape(index) {
    var platform = $('[data-field="social-platform-' + index + '"]').val();
    var url = $('[data-field="social-url-' + index + '"]').val();
    if (!url || !url.trim()) { toast('Enter a profile URL', 'warning'); return; }

    W.importedAssets.social_profiles = W.importedAssets.social_profiles || [];
    while (W.importedAssets.social_profiles.length <= index) {
      W.importedAssets.social_profiles.push({});
    }
    W.importedAssets.social_profiles[index] = { platform: platform, url: url, status: 'loading' };
    render();

    scrapeURL(url, platform, function(result) {
      result.platform = platform;
      W.importedAssets.social_profiles[index] = result;
      autoSave();
      render();
      if (result.status === 'success') toast(platform + ' profile analyzed', 'success');
    });
  }

  // ============================================================
  // SECTION 5: INLINE SECTION EDITING
  // ============================================================

  function openSectionEditor(key) {
    var current = W.generatedSections[key];
    if (!current && W.acceptedSections[key]) current = W.acceptedSections[key];
    if (!current) { toast('No content to edit', 'warning'); return; }

    var $section = $('[data-section-key="' + key + '"]');
    if (!$section.length) return;

    setSectionState(key, 'editing');
    var displayText = typeof current === 'string' ? current : JSON.stringify(current, null, 2);

    var editorHtml = '<div class="bpw-inline-editor">';
    editorHtml += '<textarea class="bpw-textarea bpw-edit-area" data-edit-key="' + esc(key) + '" style="min-height:120px;font-family:var(--bpw-font-mono);font-size:12px">' + esc(displayText) + '</textarea>';
    editorHtml += '<div class="bpw-edit-actions">';
    editorHtml += '<button class="bpw-btn bpw-btn-success bpw-btn-sm" data-action="save-edit" data-key="' + esc(key) + '">' + icon('check') + ' Save</button>';
    editorHtml += '<button class="bpw-btn bpw-btn-outline bpw-btn-sm" data-action="cancel-edit" data-key="' + esc(key) + '">' + icon('xmark') + ' Cancel</button>';
    editorHtml += '</div></div>';

    $section.find('.bpw-ais-body').html(editorHtml);
    $section.find('.bpw-edit-area').focus();
  }

  function saveInlineEdit(key) {
    var $ta = $('[data-edit-key="' + key + '"]');
    if (!$ta.length) return;

    var raw = $ta.val().trim();
    var data;

    // Try parsing as JSON first
    try {
      data = JSON.parse(raw);
    } catch (e) {
      // If not JSON, store as string
      data = raw;
    }

    W.generatedSections[key] = data;
    acceptSection(key, data);
    toast('Section saved', 'success');
    render();
  }

  function cancelInlineEdit(key) {
    var prev = W.sectionStates[key];
    setSectionState(key, W.acceptedSections[key] ? 'accepted' : 'generated');
    render();
  }

  // ============================================================
  // SECTION 6: REDO WITH GUIDANCE
  // ============================================================

  function openRedoDialog(key) {
    var $section = $('[data-section-key="' + key + '"]');
    if (!$section.length) return;

    // Quick guidance suggestions based on section type
    var suggestions = [];
    if (key.indexOf('voice_') === 0 || key.indexOf('messaging_') === 0) {
      suggestions = ['More professional', 'More casual', 'More concise', 'More energetic', 'Simpler language'];
    } else if (key.indexOf('identity_') === 0) {
      suggestions = ['More ambitious', 'More specific', 'Shorter', 'More unique', 'Focus on innovation'];
    } else if (key.indexOf('market_') === 0) {
      suggestions = ['More competitors', 'Focus on local market', 'Add pricing comparison', 'More specific data'];
    } else if (key.indexOf('audience_') === 0) {
      suggestions = ['More detailed personas', 'Different demographics', 'Add pain points', 'B2B focused'];
    } else if (key.indexOf('offerings_') === 0) {
      suggestions = ['More offerings', 'Add pricing details', 'More specific features', 'Focus on benefits'];
    } else if (key.indexOf('content_') === 0) {
      suggestions = ['More pillars', 'Different channels', 'More SEO keywords', 'Add posting schedule'];
    } else {
      suggestions = ['Make it shorter', 'More detailed', 'Different angle', 'More specific'];
    }

    var dialogHtml = '<div class="bpw-redo-dialog">';
    dialogHtml += '<div class="bpw-redo-label">' + icon('rotate-right') + ' Redo this section</div>';
    if (suggestions.length) {
      dialogHtml += '<div class="bpw-redo-chips">';
      for (var i = 0; i < suggestions.length; i++) {
        dialogHtml += '<span class="bpw-redo-chip" data-action="redo-chip">' + esc(suggestions[i]) + '</span>';
      }
      dialogHtml += '</div>';
    }
    dialogHtml += '<textarea class="bpw-textarea bpw-redo-input" data-redo-key="' + esc(key) + '" placeholder="Any guidance? Click a suggestion above or type your own..." style="min-height:60px"></textarea>';
    dialogHtml += '<div class="bpw-redo-actions">';
    dialogHtml += '<button class="bpw-btn bpw-btn-ai bpw-btn-sm" data-action="confirm-redo" data-key="' + esc(key) + '">' + icon('wand-magic-sparkles') + ' Regenerate</button>';
    dialogHtml += '<button class="bpw-btn bpw-btn-outline bpw-btn-sm" data-action="cancel-redo" data-key="' + esc(key) + '">' + icon('xmark') + ' Cancel</button>';
    dialogHtml += '</div></div>';

    $section.find('.bpw-ais-body').html(dialogHtml);
    $section.find('.bpw-redo-input').focus();
  }

  function confirmRedo(key) {
    var guidance = $('[data-redo-key="' + key + '"]').val() || '';

    if (!LLMService || !LLMService.isConfigured()) {
      toast('No AI configured', 'warning');
      return;
    }

    setSectionState(key, 'loading');
    render();

    // Determine which step prompt to use
    var stepKey = key.split('_')[0]; // e.g., 'market' from 'market_positioning'
    if (key.indexOf('voice_') === 0 || key.indexOf('messaging_') === 0) stepKey = 'voice';
    if (key.indexOf('identity_') === 0) stepKey = 'identity';
    if (key.indexOf('audience_') === 0) stepKey = 'audience';
    if (key.indexOf('offerings_') === 0) stepKey = 'offerings';
    if (key.indexOf('content_') === 0) stepKey = 'content';

    var promptFn = PROMPTS[stepKey];
    if (!promptFn) {
      toast('Cannot redo this section type', 'warning');
      setSectionState(key, 'generated');
      render();
      return;
    }

    var prompt = promptFn();
    var regenPrompt = prompt.user + '\n\nREGENERATE ONLY the "' + key + '" field from the JSON.';
    if (guidance) regenPrompt += '\n\nUser feedback on previous attempt: ' + guidance;
    regenPrompt += '\n\nReturn ONLY valid JSON with just the "' + key + '" field.' + _jsonOnly();

    LLMService.callAI(regenPrompt, function(rawText) {
      var parsed = parseAIResponse(rawText);
      if (parsed.success) {
        var data = parsed.data;
        // The response might be { key: value } or just the value
        var value = data[key] || data;
        W.generatedSections[key] = value;
        setSectionState(key, 'generated');
        toast('Section regenerated', 'success');
      } else {
        W.generatedSections[key] = parsed.rawText || '';
        setSectionState(key, 'generated');
        toast('Regenerated but needs review', 'warning');
      }
      autoSave();
      render();
    }, function(err) {
      setSectionState(key, W.generatedSections[key] ? 'generated' : 'pending');
      render();
      toast('Redo failed: ' + err, 'error');
    }, prompt.system);
  }

  // ============================================================
  // SECTION 7: ACCEPT ALL / REDO ALL
  // ============================================================

  function acceptAllForStep(stepKey) {
    var keys = getSectionKeysForStep(stepKey);
    var accepted = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (W.generatedSections[k] !== undefined && W.sectionStates[k] !== 'accepted') {
        acceptSection(k, W.generatedSections[k]);
        accepted++;
      }
    }
    if (accepted) {
      toast('Accepted ' + accepted + ' sections', 'success');
      autoSave();
      render();
    }
  }

  function redoAllForStep(stepKey) {
    // Clear generated data and re-run AI for the entire step
    var keys = getSectionKeysForStep(stepKey);
    for (var i = 0; i < keys.length; i++) {
      delete W.generatedSections[keys[i]];
      delete W.acceptedSections[keys[i]];
      setSectionState(keys[i], 'pending');
    }
    render();
    // Run AI again
    runStepAI(stepKey);
  }

  // ============================================================
  // SECTION 8: VOICE PREVIEW GENERATOR
  // ============================================================

  function generateVoicePreview(format) {
    if (!LLMService || !LLMService.isConfigured()) {
      toast('No AI configured', 'warning');
      return;
    }

    var prompt = PROMPTS.voicePreview(format);

    // Show loading in voice preview area
    var $vp = $('.bpw-vp-sample');
    if ($vp.length) {
      $vp.html('<span style="color:var(--bpw-primary)">' + icon('spinner fa-spin') + ' Generating ' + format + ' in brand voice...</span>');
    }

    LLMService.callAI(prompt.user, function(rawText) {
      // Voice preview returns raw text, not JSON
      var cleanText = rawText.replace(/```[a-z]*\s*/gi, '').replace(/```\s*/gi, '').trim();
      // Remove surrounding quotes if present
      if ((cleanText.charAt(0) === '"' && cleanText.charAt(cleanText.length - 1) === '"') ||
          (cleanText.charAt(0) === "'" && cleanText.charAt(cleanText.length - 1) === "'")) {
        cleanText = cleanText.substring(1, cleanText.length - 1);
      }

      W.generatedSections.voice_sample = cleanText;
      autoSave();
      // Update just the preview area
      if ($vp.length) {
        $vp.text(cleanText);
      } else {
        render();
      }
      toast('Voice preview generated', 'success');
    }, function(err) {
      if ($vp.length) {
        $vp.html('<span style="color:var(--bpw-error)">' + icon('circle-exclamation') + ' Failed to generate preview: ' + esc(err) + '</span>');
      }
      toast('Voice preview failed: ' + err, 'error');
    }, prompt.system);
  }

  // SECTION 9: V2 → V1 MIGRATION BRIDGE — moved to ../core/migration.js
  // (migrateV2toV1 imported at the top of this file).

  function openInAdvancedEditor() {
    var v2 = buildFinalProfile();
    var v1 = migrateV2toV1(v2);
    console.log(LOG, 'Migrated v2→v1. Sections:', Object.keys(v1).length, 'Products:', v1.products.length);

    W.$textarea.val(JSON.stringify(v1));
    if (W.$submitBtn && W.$submitBtn.length) {
      W.$submitBtn.click();
      toast('Opening Advanced Editor...', 'success');
    } else {
      toast('Profile saved. Reload to open the Advanced Editor.', 'info');
    }
  }

  // ============================================================
  // SECTION 10: EVENT WIRING
  // ============================================================

  function setupPart2AEvents() {
    // Run AI for step
    $(document).off('click.bpw2a-run').on('click.bpw2a-run', '[data-action="run-ai"]', function(e) {
      e.preventDefault();
      var stepKey = $(this).data('step');
      if (!stepKey) {
        // Use current wizard step — runStepAI handles merged step mapping
        stepKey = W.currentStepId;
      }
      runStepAI(stepKey);
    });

    // Reset identity and regenerate from scratch
    $(document).off('click.bpw2a-reset-id').on('click.bpw2a-reset-id', '[data-action="run-ai-reset-identity"]', function(e) {
      e.preventDefault();
      var stepKey = $(this).data('step');
      // Reset identity phase to initial so prompts route to mission-only
      W._identityPhase = 'initial';
      // Clear existing identity generated sections
      var idKeys = ['identity_mission_options', 'identity_mission', 'identity_vision', 'identity_values', 'identity_archetype', 'identity_pitch'];
      for (var i = 0; i < idKeys.length; i++) {
        delete W.generatedSections[idKeys[i]];
        setSectionState(idKeys[i], 'pending');
      }
      console.log(LOG, 'Identity reset — regenerating from mission options');
      runStepAI(stepKey || W.currentStepId);
    });

    // Reset audience and regenerate from scratch
    $(document).off('click.bpw2a-reset-aud').on('click.bpw2a-reset-aud', '[data-action="run-ai-reset-audience"]', function(e) {
      e.preventDefault();
      var stepKey = $(this).data('step');
      W._audiencePhase = 'initial';
      var audKeys = ['audience_primary', 'audience_segments', 'audience_personas', 'offerings_items', 'offerings_content', 'offerings_revenue', 'offerings_pricing', 'offerings_programs'];
      for (var i = 0; i < audKeys.length; i++) {
        delete W.generatedSections[audKeys[i]];
        setSectionState(audKeys[i], 'pending');
      }
      console.log(LOG, 'Audience reset — regenerating from audience');
      runStepAI(stepKey || W.currentStepId);
    });

    // Generate offerings only (after audience is accepted)
    $(document).off('click.bpw2a-gen-offerings').on('click.bpw2a-gen-offerings', '[data-action="run-ai-offerings-only"]', function(e) {
      e.preventDefault();
      runStepAI('offerings_only');
    });

    // URL scraping
    $(document).off('click.bpw2a-scrape-web').on('click.bpw2a-scrape-web', '[data-action="scrape-url"]', function(e) {
      e.preventDefault();
      handleWebsiteScrape();
    });

    $(document).off('click.bpw2a-scrape-social').on('click.bpw2a-scrape-social', '[data-action="scrape-social"]', function(e) {
      e.preventDefault();
      var idx = parseInt($(this).data('index'), 10);
      handleSocialScrape(idx);
    });

    // Section edit
    $(document).off('click.bpw2a-edit').on('click.bpw2a-edit', '[data-action="edit-section"]', function(e) {
      e.preventDefault();
      openSectionEditor($(this).data('key'));
    });

    // Save inline edit
    $(document).off('click.bpw2a-save-edit').on('click.bpw2a-save-edit', '[data-action="save-edit"]', function(e) {
      e.preventDefault();
      saveInlineEdit($(this).data('key'));
    });

    // Cancel inline edit
    $(document).off('click.bpw2a-cancel-edit').on('click.bpw2a-cancel-edit', '[data-action="cancel-edit"]', function(e) {
      e.preventDefault();
      cancelInlineEdit($(this).data('key'));
    });

    // Redo section (opens guidance dialog)
    $(document).off('click.bpw2a-redo').on('click.bpw2a-redo', '[data-action="redo-section"]', function(e) {
      e.preventDefault();
      openRedoDialog($(this).data('key'));
    });

    // Redo guidance chip — insert text into guidance textarea
    $(document).off('click.bpw2a-chip').on('click.bpw2a-chip', '[data-action="redo-chip"]', function(e) {
      e.preventDefault();
      var text = $(this).text();
      var $ta = $(this).closest('.bpw-redo-dialog').find('.bpw-redo-input');
      if ($ta.length) {
        var cur = $ta.val();
        $ta.val(cur ? cur + '. ' + text : text);
        $ta.focus();
      }
      $(this).addClass('bpw-chip-selected');
    });

    // Confirm redo (with guidance)
    $(document).off('click.bpw2a-confirm-redo').on('click.bpw2a-confirm-redo', '[data-action="confirm-redo"]', function(e) {
      e.preventDefault();
      confirmRedo($(this).data('key'));
    });

    // Cancel redo
    $(document).off('click.bpw2a-cancel-redo').on('click.bpw2a-cancel-redo', '[data-action="cancel-redo"]', function(e) {
      e.preventDefault();
      var key = $(this).data('key');
      setSectionState(key, W.generatedSections[key] ? 'generated' : 'pending');
      render();
    });

    // Accept all for step
    $(document).off('click.bpw2a-accept-all').on('click.bpw2a-accept-all', '[data-action="accept-all"]', function(e) {
      e.preventDefault();
      acceptAllForStep($(this).data('step'));
    });

    // Redo all for step
    $(document).off('click.bpw2a-redo-all').on('click.bpw2a-redo-all', '[data-action="redo-all"]', function(e) {
      e.preventDefault();
      redoAllForStep($(this).data('step'));
    });

    // Voice preview — try another format
    $(document).off('click.bpw2a-voice').on('click.bpw2a-voice', '[data-action="try-voice"]', function(e) {
      e.preventDefault();
      generateVoicePreview($(this).data('format'));
    });

    // Accept scrape result
    $(document).off('click.bpw2a-accept-scrape').on('click.bpw2a-accept-scrape', '[data-action="accept-scrape"]', function(e) {
      e.preventDefault();
      toast('Website data accepted and will inform AI generation', 'success');
    });

    // Dismiss scrape result
    $(document).off('click.bpw2a-dismiss-scrape').on('click.bpw2a-dismiss-scrape', '[data-action="dismiss-scrape"]', function(e) {
      e.preventDefault();
      W.importedAssets.website = null;
      autoSave();
      render();
      toast('Website data dismissed', 'info');
    });

    // Alternative picker selection
    $(document).off('click.bpw2a-alt').on('click.bpw2a-alt', '[data-action="select-alt"]', function(e) {
      e.preventDefault();
      var key = $(this).data('key');
      var idx = parseInt($(this).data('index'), 10);
      var options = W.generatedSections[key + '_options'];
      if (options && options[idx] !== undefined) {
        W.generatedSections[key] = options[idx];
        acceptSection(key, options[idx]);
        render();

        // Auto-trigger: when mission is selected, generate remaining identity elements
        if (key === 'identity_mission' && (W._identityPhase === 'mission_options' || W._identityPhase === 'initial')) {
          W._identityPhase = 'mission_selected';
          console.log(LOG, 'Mission selected — auto-triggering full identity generation');
          // Determine the current step key for proper prompt routing
          var currentStep = W.currentStepId;
          var idStepKey = (currentStep === 'identity_voice') ? 'identity_voice' : 'identity';
          // Small delay to let render complete and show transition
          setTimeout(function() {
            runStepAI(idStepKey);
          }, 300);
        }
      }
    });

    console.log(LOG, 'Events wired');
  }

  // ============================================================
  // SECTION 11: EXPORTS
  // ============================================================

  window._bpwPart2A = {
    initialized: true,
    runStepAI: runStepAI,
    getSectionKeysForStep: getSectionKeysForStep,
    scrapeURL: scrapeURL,
    openSectionEditor: openSectionEditor,
    openRedoDialog: openRedoDialog,
    generateVoicePreview: generateVoicePreview,
    migrateV2toV1: migrateV2toV1,
    openInAdvancedEditor: openInAdvancedEditor,
    acceptAllForStep: acceptAllForStep,
    redoAllForStep: redoAllForStep,
    PROMPTS: PROMPTS
  };

  console.log(LOG, 'Part 2A loaded');

})(jQuery, Drupal);
