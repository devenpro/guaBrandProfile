import { SCHEMA_VERSION } from './constants.js';
import { has, isLevel, isLevelOrAbove } from './brand-helpers.js';

export function getDefaultData() {
  return {
    meta: {
      schema_version: SCHEMA_VERSION,
      brand_level: '',
      brand_types: [],
      brand_subtypes: {},
      language: 'en',
      wizard_status: 'not_started',
      wizard_progress: { completed_steps: [], current_step: 'welcome', skipped_steps: [] },
      modules_enabled: [],
      detection_answers: { does: [], where: '', revenue: [] },
      created: '', last_modified: '',
      ai_provider_used: '', ai_model_used: ''
    },
    identity: {}, voice: {}, messaging: {}, audience: {}, offerings: {},
    ai_preferences: { default_provider: '', default_model: '', custom_instructions: '' }
  };
}

export function getEnabledModules() {
  var mods = ['identity', 'voice', 'messaging', 'audience', 'offerings'];
  if (isLevelOrAbove('growing') && (has('commercial') || has('local'))) mods.push('market');
  if (isLevel('deep') && has('creator')) mods.push('market');
  if (isLevelOrAbove('growing') && has('creator')) mods.push('content_strategy');
  if (isLevel('deep') && (has('commercial') || has('local'))) mods.push('content_strategy');
  if (has('commercial')) mods.push('operations');
  if (has('local')) mods.push('operations');
  if (has('nonprofit')) mods.push('operations');
  if (isLevel('deep')) mods.push('social_proof');
  return mods;
}
