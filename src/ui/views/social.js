/**
 * @category    ui
 * @purpose     Social section view — v3 page-style layout.
 *
 *              Lists every social profile inline on one page with
 *              platform select, handle/URL inputs, remove buttons,
 *              and an Add profile button. Same data slot as the
 *              scrape review pane (W.acceptedSections.social.profiles).
 *
 * @exports     window._bpwUIViews.social
 */
(function() {
  'use strict';

  var $ = window.jQuery;

  function _esc(s) { return (window._bpwEsc || function(x) { return x == null ? '' : String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); })(s); }
  function _icon(n) {
    return (window._bpwIcon || function(name) {
      if (!name) return '';
      if (name.indexOf('fa-') === 0) return '<i class="' + name + '"></i>';
      return '<i class="fa-solid fa-' + name + '"></i>';
    })(n);
  }

  var PLATFORMS = ['youtube', 'instagram', 'linkedin', 'twitter_x', 'facebook', 'tiktok', 'google_business', 'other'];
  var PLATFORM_LABELS = {
    youtube: 'YouTube', instagram: 'Instagram', linkedin: 'LinkedIn',
    twitter_x: 'X (Twitter)', facebook: 'Facebook', tiktok: 'TikTok',
    google_business: 'Google Business', other: 'Other'
  };

  function _profiles(W) {
    var s = (W.acceptedSections && W.acceptedSections.social) || {};
    return Array.isArray(s.profiles) ? s.profiles : [];
  }

  function _ensureSlot(W) {
    W.acceptedSections = W.acceptedSections || {};
    W.acceptedSections.social = W.acceptedSections.social || { profiles: [] };
    if (!Array.isArray(W.acceptedSections.social.profiles)) W.acceptedSections.social.profiles = [];
    return W.acceptedSections.social.profiles;
  }

  function renderList() { return ''; }

  function renderDetail(W) {
    var profiles = _profiles(W);
    var html = '<section class="bpw-shell-detail bpw-shell-detail--page" aria-label="Social profiles">';
    html += '<header class="bpw-shell-detail-head">';
    html += '<h1>Social profiles</h1>';
    html += '<p class="bpw-shell-detail-sub">Accounts the brand publishes on. Ship out as <code>field_brand_social</code>.</p>';
    html += '</header>';

    html += '<div class="bpw-page-fields">';
    html += '<div class="bpw-page-collection-head">';
    html += '<h2 class="bpw-page-collection-title">' + profiles.length + ' profile' + (profiles.length === 1 ? '' : 's') + '</h2>';
    html += '<button class="bpw-page-collection-add" data-action="bpw-social-add" type="button">' + _icon('plus') + ' Add profile</button>';
    html += '</div>';

    if (!profiles.length) {
      html += '<div class="bpw-page-collection-empty">No social profiles yet. Click Add profile to add one.</div>';
    } else {
      html += '<div class="bpw-social-rows">';
      for (var i = 0; i < profiles.length; i++) {
        var p = profiles[i] || {};
        html += '<div class="bpw-social-row" data-profile-idx="' + i + '">';
        html += '<select class="bpw-social-platform" data-profile-field="platform">';
        for (var k = 0; k < PLATFORMS.length; k++) {
          var key = PLATFORMS[k];
          html += '<option value="' + key + '"' + (p.platform === key ? ' selected' : '') + '>' + _esc(PLATFORM_LABELS[key]) + '</option>';
        }
        html += '</select>';
        html += '<input class="bpw-social-handle" data-profile-field="handle" type="text" placeholder="@handle" value="' + _esc(p.handle || '') + '">';
        html += '<input class="bpw-social-url" data-profile-field="url" type="url" placeholder="https://…" value="' + _esc(p.url || '') + '">';
        html += '<button class="bpw-social-remove" data-action="bpw-social-remove" type="button" title="Remove">' + _icon('trash') + '</button>';
        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    html += '</section>';
    return html;
  }

  function _persist(W) {
    if (window._bpwExportSync) window._bpwExportSync.syncAll();
    if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
    if (window._bpwAutoSave) window._bpwAutoSave();
    if (window._bpwAppShell) window._bpwAppShell.render();
    if (window._bpwSetup && window._bpwSetup.render) window._bpwSetup.render();
  }

  $(document).off('input.bpw-social change.bpw-social', '[data-profile-field]')
    .on('input.bpw-social change.bpw-social', '[data-profile-field]', function() {
      var W = window._bpwState;
      if (!W) return;
      var $row = $(this).closest('.bpw-social-row');
      var idx = parseInt($row.attr('data-profile-idx'), 10);
      if (isNaN(idx)) return;
      var arr = _ensureSlot(W);
      arr[idx] = arr[idx] || {};
      arr[idx][$(this).data('profile-field')] = $(this).val();
      if (window._bpwExportSync) window._bpwExportSync.syncAll();
      if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
      if (window._bpwAutoSave) window._bpwAutoSave();
    });

  $(document).off('click.bpw-social-add', '[data-action="bpw-social-add"]')
    .on('click.bpw-social-add', '[data-action="bpw-social-add"]', function(e) {
      e.preventDefault();
      var W = window._bpwState;
      if (!W) return;
      var arr = _ensureSlot(W);
      arr.push({ platform: 'other', handle: '', url: '' });
      _persist(W);
    });

  $(document).off('click.bpw-social-remove', '[data-action="bpw-social-remove"]')
    .on('click.bpw-social-remove', '[data-action="bpw-social-remove"]', function(e) {
      e.preventDefault();
      var W = window._bpwState;
      if (!W) return;
      var $row = $(this).closest('.bpw-social-row');
      var idx = parseInt($row.attr('data-profile-idx'), 10);
      if (isNaN(idx)) return;
      var arr = _ensureSlot(W);
      arr.splice(idx, 1);
      _persist(W);
    });

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.social = {
    id: 'social',
    title: 'Social',
    minLevel: 'new',
    listMode: 'none',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
