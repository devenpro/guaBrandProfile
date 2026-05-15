/**
 * @category    ui.editors
 * @purpose     Dotted-path get/set on W.acceptedSections plus the
 *              shared "field-edited" pipeline: persist + autosave +
 *              re-render.
 *
 *              Paths use dot notation with optional [index] segments:
 *                identity.mission
 *                voice.dos
 *                audience.segments[2].name
 *                content_strategy.pillars[0].topics[3]
 *
 *              Writes go through W.acceptedSections, then fire
 *              _bpwExportSync.syncAll → _bpwSyncToTextarea →
 *              _bpwAutoSave. Calling `render()` is optional and only
 *              needed when the shape of the data (added/removed rows)
 *              changed — text edits skip it to keep focus.
 *
 * @exports     window._bpwPathStore = { get, set, push, removeAt, persist, persistAndRender }
 */
(function() {
  'use strict';

  function _segments(path) {
    // Split "a.b[2].c" into ['a', 'b', 2, 'c'].
    var out = [];
    var re = /([^.\[\]]+)|\[(\d+)\]/g;
    var m;
    while ((m = re.exec(path))) {
      if (m[2] !== undefined) out.push(parseInt(m[2], 10));
      else out.push(m[1]);
    }
    return out;
  }

  function _root() {
    var W = window._bpwState;
    if (!W) return null;
    W.acceptedSections = W.acceptedSections || {};
    return W.acceptedSections;
  }

  function get(path) {
    var root = _root();
    if (!root) return undefined;
    var segs = _segments(path);
    var cur = root;
    for (var i = 0; i < segs.length; i++) {
      if (cur == null) return undefined;
      cur = cur[segs[i]];
    }
    return cur;
  }

  function set(path, value) {
    var root = _root();
    if (!root) return;
    var segs = _segments(path);
    var cur = root;
    for (var i = 0; i < segs.length - 1; i++) {
      var seg = segs[i];
      var next = segs[i + 1];
      if (cur[seg] == null) {
        cur[seg] = (typeof next === 'number') ? [] : {};
      }
      cur = cur[seg];
    }
    cur[segs[segs.length - 1]] = value;
  }

  function push(path, value) {
    var arr = get(path);
    if (!Array.isArray(arr)) {
      set(path, []);
      arr = get(path);
    }
    arr.push(value);
  }

  function removeAt(path, index) {
    var arr = get(path);
    if (Array.isArray(arr)) arr.splice(index, 1);
  }

  function persist() {
    if (window._bpwExportSync) window._bpwExportSync.syncAll();
    if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
    if (window._bpwAutoSave) window._bpwAutoSave();
  }

  function persistAndRender() {
    persist();
    if (window._bpwAppShell && window._bpwAppShell.render) window._bpwAppShell.render();
  }

  window._bpwPathStore = {
    get: get,
    set: set,
    push: push,
    removeAt: removeAt,
    persist: persist,
    persistAndRender: persistAndRender
  };
})();
