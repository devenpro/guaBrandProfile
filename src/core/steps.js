// Pure read helpers over W.steps. Building W.steps lives in
// bpw-app.js §7 STEP BUILDER and will move once it can be cleanly
// disentangled from getEnabledModules / has / isLevel call patterns.
import { W } from './state.js';

export function stepIndex() {
  for (var i = 0; i < W.steps.length; i++) {
    if (W.steps[i].id === W.currentStepId) return i;
  }
  return 0;
}

export function stepById(id) {
  for (var i = 0; i < W.steps.length; i++) {
    if (W.steps[i].id === id) return W.steps[i];
  }
  return null;
}

export function isStepAvailable(id) {
  return !!stepById(id);
}

export function getStepNumber() {
  return stepIndex() + 1;
}

export function getTotalSteps() {
  return W.steps.length;
}
