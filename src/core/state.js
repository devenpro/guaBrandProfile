// Shared wizard state. Mutated in place throughout the app and
// exposed on window._bpwState by the legacy boot for parts 2a/2b/2c
// that still consume it via the global namespace.
export const W = {
  $textarea: null, $form: null, $submitBtn: null,
  brandLevel: '', brandTypes: [], brandSubtypes: {}, language: 'en',
  detection: { does: [], where: '', revenue: [] },
  steps: [], currentStepId: 'welcome', completedSteps: [], skippedSteps: [],
  seedContext: {}, importedAssets: {}, discoveryAnswers: {},
  generatedSections: {}, acceptedSections: {},
  sectionStates: {},
  data: {},
  aiProvider: '', aiModel: '',
  isAIProcessing: false,
  dirty: false, lastSaved: null, autoSaveTimer: null,
  initialized: false, _initializing: false, isResuming: false,
  _socialRows: 1,
  _identityPhase: 'initial',
  _audiencePhase: 'initial',
  activityLog: []
};
