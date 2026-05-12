export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateId(prefix) {
  return (prefix || 'id') + '_' + Math.random().toString(36).substr(2, 6);
}

export function now() {
  return new Date().toISOString();
}

export function formatRelativeTime(iso) {
  if (!iso) return '';
  var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

export function deepClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
}

export function truncate(str, len) {
  str = str || '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

export function isEmpty(val) {
  if (val === null || val === undefined || val === '') return true;
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === 'object') return Object.keys(val).length === 0;
  return false;
}

export function debounce(fn, ms) {
  var timer;
  return function() {
    var ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
  };
}

export function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}
