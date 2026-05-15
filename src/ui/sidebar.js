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

  var SECTIONS = [
    { id: 'identity',  label: 'Identity',  icon: 'fingerprint',    minLevel: 'new' },
    { id: 'voice',     label: 'Voice',     icon: 'comment-dots',   minLevel: 'new' },
    { id: 'audience',  label: 'Audience',  icon: 'users',          minLevel: 'new' },
    { id: 'offerings', label: 'Offerings', icon: 'box-open',       minLevel: 'new', brandTypes: ['commercial', 'local', 'nonprofit'] },
    { id: 'market',    label: 'Market',    icon: 'chart-line',     minLevel: 'growing', brandTypes: ['commercial', 'local'] },
    { id: 'content',   label: 'Content',   icon: 'pen-nib',        minLevel: 'new',  brandTypes: ['creator', 'commercial'] },
    { id: 'seo',       label: 'SEO',       icon: 'magnifying-glass', minLevel: 'growing' },
    { id: 'settings',  label: 'Settings',  icon: 'gear',           minLevel: 'new', isMeta: true }
  ];

  function _visibleSections(W) {
    var levelOrder = (window._bpwConstants && window._bpwConstants.LEVEL_ORDER) || { 'new': 0, 'growing': 1, 'deep': 2 };
    var currentRank = levelOrder[W.brandLevel || 'new'] || 0;
    var types = W.brandTypes || [];
    return SECTIONS.filter(function(s) {
      var rank = levelOrder[s.minLevel] || 0;
      if (rank > currentRank) return false;
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
    var active = (W.ui && W.ui.section) || 'identity';
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
