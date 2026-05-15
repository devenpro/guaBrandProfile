/**
 * @category    ui
 * @purpose     Social section view. variable-items mode.
 *              Lists every social profile saved on the brand (platform,
 *              handle, URL). Inline editing + add/remove rows. Writes
 *              into W.acceptedSections.social.profiles which Phase 4's
 *              export-sync hook funnels into field_brand_social.
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

  function renderList(W) {
    var profiles = _profiles(W);
    var active = (W.ui && W.ui.itemId) || null;
    if (!profiles.length) {
      return '<div class="bpw-shell-list-empty">'
        + _icon('share-nodes')
        + '<div>No social profiles yet.</div>'
        + '<div style="font-size:var(--bpw-font-xs);color:var(--bpw-text-muted);margin-top:var(--bpw-sp-1);">Use Add profile below to add one.</div>'
        + '</div>';
    }
    var html = '';
    for (var i = 0; i < profiles.length; i++) {
      var p = profiles[i] || {};
      var id = 'profile:' + i;
      var cls = active === id ? 'bpw-shell-card bpw-shell-card-active' : 'bpw-shell-card';
      var label = PLATFORM_LABELS[p.platform] || p.platform || 'Profile ' + (i + 1);
      html += '<article class="' + cls + '" data-item-id="' + _esc(id) + '" role="button" tabindex="0">';
      html += '<div class="bpw-shell-card-title">' + _esc(label) + '</div>';
      html += '<div class="bpw-shell-card-snippet">' + _esc(p.handle || p.url || '—') + '</div>';
      html += '</article>';
    }
    return html;
  }

  function renderDetail(W, selectedId) {
    var profiles = _profiles(W);
    var html = '<div class="bpw-shell-detail-card">';
    html += '<h3>' + _icon('share-nodes') + ' Social profiles</h3>';
    html += '<p style="margin:0 0 var(--bpw-sp-4);color:var(--bpw-text-sec);font-size:var(--bpw-font-sm);">Add and edit the social accounts the brand publishes on. These ship out as <code>field_brand_social</code>.</p>';

    if (!profiles.length) {
      html += '<div class="bpw-shell-detail-value bpw-shell-detail-value-empty">No profiles yet.</div>';
    } else {
      html += '<div class="bpw-social-rows">';
      for (var i = 0; i < profiles.length; i++) {
        var p = profiles[i] || {};
        var hi = selectedId === ('profile:' + i);
        html += '<div class="bpw-social-row' + (hi ? ' is-active' : '') + '" data-profile-idx="' + i + '">';
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

    html += '<div class="bpw-social-actions">';
    html += '<button class="bpw-shell-action-btn" data-action="bpw-social-add" type="button">' + _icon('plus') + ' Add profile</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function _persist(W) {
    if (window._bpwExportSync) window._bpwExportSync.syncAll();
    if (window._bpwSyncToTextarea) window._bpwSyncToTextarea();
    if (window._bpwAutoSave) window._bpwAutoSave();
    if (window._bpwAppShell) window._bpwAppShell.render();
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
      // Avoid full re-render on every keystroke; just sync state.
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
    listMode: 'variable-items',
    renderList: renderList,
    renderDetail: renderDetail,
    inlineActions: []
  };
})();
