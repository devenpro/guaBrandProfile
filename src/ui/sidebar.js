/**
 * @category    ui
 * @purpose     210px sidebar. Lists top-level sections of the brand
 *              profile. Sections hidden when W.brandLevel is below the
 *              section's minLevel — downgrade is non-destructive (data
 *              persists, UI just doesn't expose the section anymore).
 *
 * @exports     window._bpwSidebar = { render(W), SECTIONS }
 *
 * Section list is fixed; view modules (Phase 4.2) supply listMode + rendering.
 */
(function() {
  'use strict';

  function _esc(s) {
    return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s);
  }
  function _icon(n) {
    return (window._bpwIcon || function(name) {
      if (!name) return '';
      if (name.indexOf('fa-') === 0) return '<i class="' + name + '"></i>';
      return '<i class="fa-solid fa-' + name + '"></i>';
    })(n);
  }

  // v2: uniform UI for all growth phases — sidebar shows the same
  // sections regardless of brandLevel. Phase only affects prompt depth,
  // not which screens exist. The minLevel keys are preserved for the
  // old _visibleSections filter (still callable by external code) but
  // the default render path uses _allSections so nothing is hidden.
  var SECTIONS = [
    { id: 'dashboard',   label: 'Dashboard',   icon: 'gauge-high',        minLevel: 'new', isDefault: true },
    { id: 'identity',    label: 'Identity',    icon: 'fingerprint',       minLevel: 'new' },
    { id: 'voice',       label: 'Voice',       icon: 'comment-dots',      minLevel: 'new' },
    { id: 'audience',    label: 'Audience',    icon: 'users',             minLevel: 'new' },
    { id: 'offerings',   label: 'Offerings',   icon: 'box-open',          minLevel: 'new', brandTypes: ['commercial', 'local', 'nonprofit'] },
    { id: 'market',      label: 'Market',      icon: 'chart-line',        minLevel: 'new' },
    { id: 'competitors', label: 'Competitors', icon: 'crosshairs',        minLevel: 'new' },
    { id: 'content',     label: 'Content',     icon: 'pen-nib',           minLevel: 'new' },
    { id: 'seo',         label: 'SEO',         icon: 'magnifying-glass',  minLevel: 'new' },
    { id: 'social',      label: 'Social',      icon: 'share-nodes',       minLevel: 'new' },
    { id: 'settings',    label: 'Settings',    icon: 'gear',              minLevel: 'new', isMeta: true }
  ];

  // v2 uniform-UI default: surface every section for every phase. Brand-
  // type gating is preserved (e.g. Offerings hidden for pure Creator
  // brands) since it's a content-relevance signal, not a phase signal.
  function _visibleSections(W) {
    var types = W.brandTypes || [];
    return SECTIONS.filter(function(s) {
      if (s.brandTypes) {
        var matches = false;
        for (var i = 0; i < s.brandTypes.length; i++) {
          if (types.indexOf(s.brandTypes[i]) !== -1) { matches = true; break; }
        }
        if (!matches) return false;
      }
      return true;
    });
  }

  function render(W) {
    var active = (W.ui && W.ui.section) || 'dashboard';
    var visible = _visibleSections(W);
    var html = '<aside class="bpw-shell-sidebar" role="navigation" aria-label="Brand sections">';
    html += '<div class="bpw-shell-sidebar-group">';
    for (var i = 0; i < visible.length; i++) {
      var s = visible[i];
      if (s.isMeta) continue;
      var cls = active === s.id ? 'bpw-shell-nav-item bpw-shell-nav-active' : 'bpw-shell-nav-item';
      html += '<button class="' + cls + '" data-section="' + _esc(s.id) + '" type="button">';
      html += '<span class="bpw-shell-nav-icon">' + _icon(s.icon) + '</span>';
      html += '<span class="bpw-shell-nav-label">' + _esc(s.label) + '</span>';
      html += '</button>';
    }
    html += '</div>';

    // Meta section (Settings) sticks to the bottom.
    html += '<div class="bpw-shell-sidebar-group bpw-shell-sidebar-meta">';
    for (var j = 0; j < visible.length; j++) {
      if (!visible[j].isMeta) continue;
      var ss = visible[j];
      var cls2 = active === ss.id ? 'bpw-shell-nav-item bpw-shell-nav-active' : 'bpw-shell-nav-item';
      html += '<button class="' + cls2 + '" data-section="' + _esc(ss.id) + '" type="button">';
      html += '<span class="bpw-shell-nav-icon">' + _icon(ss.icon) + '</span>';
      html += '<span class="bpw-shell-nav-label">' + _esc(ss.label) + '</span>';
      html += '</button>';
    }
    html += '</div>';
    html += '</aside>';
    return html;
  }

  window._bpwSidebar = { render: render, SECTIONS: SECTIONS };
})();
