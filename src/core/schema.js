import { SCHEMA_VERSION } from './constants.js';

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
