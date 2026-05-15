/**
 * @category    ui
 * @purpose     Top bar: brand name + breadcrumb + activity-drawer toggle.
 * @exports     window._bpwTopbar = { render(W) }
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

  function render(W) {
    var brand = ((W.acceptedSections || {}).identity || {}).name || (W.seedContext && W.seedContext.name) || 'Brand profile';
    var sectionId = (W.ui && W.ui.section) || 'identity';
    var SECTIONS = (window._bpwSidebar && window._bpwSidebar.SECTIONS) || [];
    var sectionLabel = sectionId;
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === sectionId) { sectionLabel = SECTIONS[i].label; break; }

    var html = '<header class="bpw-shell-topbar">';
    html += '<div class="bpw-shell-topbar-brand">' + _icon('sparkles') + '<span class="bpw-shell-topbar-name">' + _esc(brand) + '</span></div>';
    html += '<nav class="bpw-shell-topbar-crumbs" aria-label="Breadcrumb">';
    html += '<span class="bpw-shell-topbar-crumb">Brand profile</span>';
    html += '<span class="bpw-shell-topbar-crumb-sep">/</span>';
    html += '<span class="bpw-shell-topbar-crumb bpw-shell-topbar-crumb-active">' + _esc(sectionLabel) + '</span>';
    html += '</nav>';
    html += '<div class="bpw-shell-topbar-actions">';
    html += '<button class="bpw-shell-topbar-btn" data-action="open-activity" type="button" title="Activity log">' + _icon('clock-rotate-left') + '</button>';
    html += '</div>';
    html += '</header>';
    return html;
  }

  window._bpwTopbar = { render: render };
})();
