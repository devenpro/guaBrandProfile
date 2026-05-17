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
  activityLog: [],
  // Autopilot setup state — populated by src/setup/. Shape:
  //   { open, mode, currentStageId, stagesQueue[], stageStatus{},
  //     totalElapsedMs, paused, startedAt, finishedAt? }
  setup: null,
  // v2 wizard state — populated by src/wizard/ on entry (Phase 2+).
  // Shape: { currentStep, stageQueue[], stageResults{}, lastApprovedStage,
  //          startedAt, source: 'setup' | 'phase-upgrade' }
  _wizardV2: null,
  // Resume-editing affordance for the new dashboard. Written by the
  // app shell on navigation; read by the dashboard hero pill.
  _lastOpenedPage: null,
  _lastOpenedField: null
};
