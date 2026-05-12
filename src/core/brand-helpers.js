// Tiny derived-state helpers over the W brand context. Pure reads.
import { W } from './state.js';
import { BRAND_TYPES, LEVEL_ORDER } from './constants.js';

export function has(type) {
  return W.brandTypes.indexOf(type) !== -1;
}

export function isLevel(lvl) {
  return W.brandLevel === lvl;
}

export function isLevelOrAbove(lvl) {
  return (LEVEL_ORDER[W.brandLevel] || 0) >= (LEVEL_ORDER[lvl] || 0);
}

export function typeLabels() {
  return W.brandTypes.map(function(t) { return (BRAND_TYPES[t] || {}).label || t; }).join(' + ');
}
