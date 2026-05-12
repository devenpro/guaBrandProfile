// Pure data transformation: convert v2 modular schema to v1 flat schema
// for the legacy Advanced Editor. No DOM, no AJAX — only object reshape.
import { generateId } from '../utils/helpers.js';

export function migrateV2toV1(v2) {
  var v1 = _getDefaultV1();

  // -- Identity → Foundation --
  var id = v2.identity || {};
  var f = v1.foundation;
  f.name_display = id.name || '';
  f.tagline = id.tagline || '';
  f.mission = id.mission || '';
  f.vision = id.vision || '';
  f.website_url = id.website_url || '';
  f.industry_primary = id.industry || '';
  f.founded_year = id.founded_year || '';
  f.headquarters = id.headquarters || '';
  f.contact_email = id.contact_email || '';
  f.brand_archetype = id.brand_archetype || '';
  f.positioning_statement = id.positioning_statement || '';
  f.unique_value_proposition = id.positioning_statement || '';
  if (id.elevator_pitch) f.elevator_pitches.s30 = id.elevator_pitch;

  if (id.values && Array.isArray(id.values)) {
    f.core_values = id.values.map(function(v) {
      return { id: v.id || generateId('cv'), value: v.value || '', description: v.description || '' };
    });
  }

  if (id.social_profiles && Array.isArray(id.social_profiles)) {
    for (var si = 0; si < id.social_profiles.length; si++) {
      var sp = id.social_profiles[si];
      var platKey = sp.platform || 'other';
      if (f.social_profiles[platKey]) {
        f.social_profiles[platKey] = { url: sp.url || '', handle: sp.handle || '' };
      } else {
        f.social_profiles.other = f.social_profiles.other || [];
        f.social_profiles.other.push({ platform: platKey, url: sp.url || '', handle: sp.handle || '' });
      }
    }
  }

  if (id.key_people && Array.isArray(id.key_people)) {
    f.key_people = id.key_people.map(function(kp) {
      return { id: kp.id || generateId('kp'), name: kp.name || '', role: kp.role || '', bio_short: kp.bio || '', is_spokesperson: kp.is_spokesperson || false };
    });
  }

  // -- Voice --
  var vc = v2.voice || {};
  var v1v = v1.voice;
  v1v.primary_tone = vc.primary_tone || '';
  v1v.personality_traits = vc.personality_traits || [];
  v1v.always_do = vc.dos || [];
  v1v.never_do = vc.donts || [];
  if (vc.writing_style) {
    v1v.writing_style.formality_level = vc.writing_style.formality || '';
    v1v.writing_style.sentence_length = vc.writing_style.sentence_length || '';
    v1v.writing_style.paragraph_structure = vc.writing_style.paragraph_structure || '';
  }
  if (vc.vocabulary) {
    v1v.vocabulary.preferred_terms = vc.vocabulary.preferred_terms || [];
    v1v.vocabulary.forbidden_words = vc.vocabulary.avoided_terms || [];
  }
  if (vc.tone_by_context && Array.isArray(vc.tone_by_context)) {
    for (var ti = 0; ti < vc.tone_by_context.length; ti++) {
      var tc = vc.tone_by_context[ti];
      var chanKey = (tc.context || '').toLowerCase().replace(/[^a-z]/g, '');
      if (chanKey && v1v.tone_by_channel.hasOwnProperty(chanKey)) {
        v1v.tone_by_channel[chanKey] = tc.tone || '';
      }
    }
  }

  // -- Messaging --
  var msg = v2.messaging || {};
  var v1m = v1.messaging;
  v1m.primary_message = msg.primary_message || '';
  v1m.supporting_messages = msg.supporting_messages || [];
  v1m.cta_phrases = msg.cta_phrases || [];
  if (msg.boilerplate) {
    v1m.boilerplate.short = msg.boilerplate.short || '';
    v1m.boilerplate.medium = msg.boilerplate.medium || '';
    v1m.boilerplate.long = msg.boilerplate.long || '';
  }
  if (msg.value_propositions) {
    v1m.value_statements = msg.value_propositions.map(function(vp) {
      return { id: vp.id || generateId('vs'), statement: vp.proposition || '', evidence: vp.proof || '' };
    });
  }
  if (msg.headlines) {
    v1m.headline_variations = msg.headlines.map(function(hl) {
      return { id: hl.id || generateId('hl'), context: hl.context || '', headline: hl.headline || '' };
    });
  }

  // -- Audience --
  var aud = v2.audience || {};
  v1.audience.demographics = aud.demographics || {};
  v1.audience.languages = (aud.demographics || {}).languages || [];
  if (aud.segments) {
    v1.audience.customer_segments = aud.segments.map(function(s) {
      return { id: s.id || generateId('seg'), name: s.name || '', description: s.description || '', pain_points: s.pain_points || [], goals: s.goals || [] };
    });
  }
  if (aud.personas) {
    v1.audience.personas = aud.personas.map(function(p) {
      return {
        id: p.id || generateId('per'), name: p.name || '', role: p.role || '', age_range: p.age || '',
        story: p.story || '', pain_points: p.pain_points || [], goals: p.goals || [],
        decision_criteria: p.decision_criteria || [], buying_journey: p.journey || '',
        preferred_channels: [], trusted_sources: []
      };
    });
  }

  // -- Offerings → Products --
  var off = v2.offerings || {};
  if (off.items && Array.isArray(off.items)) {
    v1.products = off.items.map(function(o) {
      return {
        id: o.id || generateId('prod'), name: o.name || '', category: o.category || '',
        description_short: o.description || '', description_full: o.description || '',
        features: o.features || [], benefits_functional: o.benefits || [],
        target_customer: o.target_audience || '', status: o.status || 'active',
        competitive_advantages: o.differentiators || [], objections: []
      };
    });
  }

  // -- Pricing --
  if (off.pricing_model) {
    var pm = off.pricing_model;
    v1.pricing.currency = pm.currency || 'USD';
    v1.pricing.model_summary = pm.type || '';
    if (pm.free_trial) v1.pricing.free_trial = pm.free_trial;
    if (pm.plans) {
      v1.pricing.plans = pm.plans.map(function(p) {
        return {
          id: p.id || generateId('plan'), name: p.name || '', type: 'subscription',
          billing: { monthly: { price: p.price_monthly || 0 }, yearly: { price: p.price_yearly || 0 } },
          features: p.features || [], is_active: true
        };
      });
    }
  }

  // -- Market → Competitive --
  var mkt = v2.market || {};
  v1.competitive.market_category = mkt.category || '';
  v1.competitive.positioning_statement = mkt.positioning || '';
  if (mkt.competitors) {
    v1.competitive.competitors = mkt.competitors.map(function(c) {
      return {
        id: c.id || generateId('comp'), name: c.name || '', description: c.description || '',
        website_url: c.url || '', strengths: c.strengths || [], weaknesses: c.weaknesses || []
      };
    });
  }
  if (mkt.differentiators) {
    v1.competitive.key_differentiators = mkt.differentiators.map(function(d) {
      return { id: d.id || generateId('kd'), differentiator: d.point || '', evidence: d.evidence || '' };
    });
  }

  // -- Content Strategy --
  var cs = v2.content_strategy || {};
  if (cs.pillars) v1.content.pillars = cs.pillars;
  if (cs.seo_keywords) v1.content.seo_keywords = cs.seo_keywords;
  if (cs.hashtags) v1.content.hashtag_strategy = { primary: cs.hashtags };
  if (cs.channels) {
    v1.content.publishing_schedule = {};
    for (var ci = 0; ci < cs.channels.length; ci++) {
      var ch = cs.channels[ci];
      v1.content.publishing_schedule[ch.channel || 'general'] = { frequency: ch.frequency || '', format: ch.format || '' };
    }
  }

  // -- Operations --
  var ops = v2.operations || {};
  if (ops.sales) {
    v1.sales.process_stages = (ops.sales.stages || []).map(function(s, i) {
      return { id: generateId('stg'), stage: typeof s === 'string' ? s : s.name || '', order: i + 1 };
    });
    if (ops.sales.objection_responses) {
      v1.sales.objections = ops.sales.objection_responses.map(function(o) {
        return { id: o.id || generateId('obj'), objection: o.objection || '', response: o.response || '' };
      });
    }
  }
  if (ops.support) {
    if (ops.support.common_issues) {
      v1.support.common_issues = ops.support.common_issues.map(function(i) {
        return { id: i.id || generateId('si'), issue: i.issue || '', solution: i.solution || '' };
      });
    }
  }

  // -- Meta --
  v1.meta.wizard_status = 'complete';
  v1.meta.schema_version = '1.0';
  v1.meta.migrated_from = '2.0';
  v1.meta.wizard_completed_at = new Date().toISOString();
  v1.meta.created = (v2.meta || {}).created || new Date().toISOString();
  v1.meta.last_synced = new Date().toISOString();

  return v1;
}

function _getDefaultV1() {
  return {
    foundation: {
      name_display: '', name_legal: '', name_abbreviations: [], tagline: '', tagline_history: [],
      mission: '', vision: '', core_values: [], brand_promise: '', unique_value_proposition: '',
      founding_story: '', brand_archetype: '', positioning_statement: '',
      elevator_pitches: { s15: '', s30: '', s60: '' },
      website_url: '', founded_year: '', headquarters: '', industry_primary: '', contact_email: '',
      social_profiles: {
        youtube: { url: '', handle: '' }, linkedin: { url: '', handle: '' },
        twitter_x: { url: '', handle: '' }, instagram: { url: '', handle: '' },
        facebook: { url: '', handle: '' }, tiktok: { url: '', handle: '' },
        github: { url: '', handle: '' }, other: []
      },
      key_people: [], milestones: []
    },
    voice: {
      primary_tone: '', secondary_tones: [], personality_traits: [],
      writing_style: { sentence_length: '', paragraph_structure: '', formality_level: '' },
      always_do: [], never_do: [],
      vocabulary: { preferred_terms: [], brand_phrases: [], forbidden_words: [], jargon_policy: '' },
      tone_by_channel: { email: '', social: '', support: '', sales: '', pr: '' },
      tone_by_situation: { crisis: '', celebration: '', announcement: '', apology: '' },
      examples: []
    },
    messaging: {
      primary_message: '', supporting_messages: [], value_statements: [], proof_points: [],
      boilerplate: { short: '', medium: '', long: '' },
      headline_variations: [], cta_phrases: [], transition_phrases: []
    },
    products: [],
    pricing: { currency: 'USD', currency_symbol: '$', model_summary: '', plans: [], add_ons: [], free_trial: {}, custom_pricing_note: '' },
    audience: { demographics: {}, personas: [], industries_served: [], geographic_focus: [], customer_segments: [], languages: [] },
    competitive: { market_category: '', positioning_statement: '', key_differentiators: [], competitors: [], indirect_competitors: [], competitive_talking_points: [], comparison_matrices: [] },
    sales: { process_stages: [], discovery_questions: [], objections: [], pricing_justification: [], roi_points: [], closing_phrases: [] },
    support: { common_issues: [], escalation_triggers: [], escalation_procedure: '', sla_commitments: '', onboarding_steps: [], success_milestones: [], churn_warning_signs: [], winback_messaging: '' },
    content: { pillars: [], topics_cover: [], seo_keywords: [], hashtag_strategy: {}, publishing_schedule: {} },
    faqs: [],
    social_proof: { testimonials: [], case_studies: [], statistics: [], awards: [] },
    legal: { disclaimers: [], trademark_rules: '', prohibited_claims: [], compliance_notes: '' },
    assets: { colors: { primary: [], secondary: [], neutral: [] }, typography: {}, logo_url: '', brand_kit_url: '', favicon_url: '' },
    templates: [],
    meta: { brand_id: '', created: '', last_synced: '', completeness: {}, ai_editable: {} },
    aiPreferences: { perAction: {}, lastProvider: '', lastModel: '', appDefault: null },
    activity_log: []
  };
}
