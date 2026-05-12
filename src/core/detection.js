// Map the user's three detection answers (does / where / revenue) to
// a list of brand types. Pure read of W.detection — no mutation.
import { W } from './state.js';

export function detectTypes() {
  var d = W.detection, t = [];
  var doesArr = d.does || [], where = d.where || '', rev = d.revenue || [];

  if (doesArr.indexOf('products') !== -1 || doesArr.indexOf('services') !== -1) {
    if (where === 'physical' || where === 'both') { if (t.indexOf('local') === -1) t.push('local'); }
    if (where === 'online' || where === 'both') { if (t.indexOf('commercial') === -1) t.push('commercial'); }
    if (!where) { if (t.indexOf('commercial') === -1) t.push('commercial'); }
  }
  if (doesArr.indexOf('content') !== -1) { if (t.indexOf('creator') === -1) t.push('creator'); }
  if (doesArr.indexOf('cause') !== -1) { if (t.indexOf('nonprofit') === -1) t.push('nonprofit'); }

  if (rev.indexOf('ads') !== -1 || rev.indexOf('courses') !== -1) {
    if (t.indexOf('creator') === -1) t.push('creator');
  }
  if (rev.indexOf('donations') !== -1) {
    if (t.indexOf('nonprofit') === -1) t.push('nonprofit');
  }
  if (rev.indexOf('products') !== -1 || rev.indexOf('subscriptions') !== -1 || rev.indexOf('services') !== -1) {
    if (t.indexOf('commercial') === -1 && t.indexOf('local') === -1) t.push('commercial');
  }

  if (!t.length && doesArr.length) t.push('commercial');
  return t;
}
