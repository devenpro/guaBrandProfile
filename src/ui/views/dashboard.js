/**
 * @category    ui
 * @purpose     Dashboard view — brand-at-a-glance hero + completion grid
 *              for every section. v2 makes Dashboard the default landing
 *              section after autopilot finishes so users see overall
 *              brand state instead of being dumped into an editor.
 *
 *              Renders into the detail-pane's slot. The section-list
 *              pane is hidden via CSS when the dashboard section is
 *              active (see bpw-app.css :has selector).
 *
 * @exports     window._bpwUIViews.dashboard = { renderDetail(W) }
 *
 * @depends-on  window._bpwState, window._bpwSidebar (SECTIONS),
 *              window.BrandService (for the brand-at-a-glance summary)
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

  function _truncate(s, n) {
    if (!s) return '';
    s = String(s);
    return s.length > n ? s.substring(0, n - 1) + '…' : s;
  }

  // Estimate per-section completion percentage. Counts the number of
  // populated key fields each section claims a "complete" state for.
  // Numbers are rough on purpose — the dashboard is a glance, not a
  // dashboard-of-truth. Each section view is the place to dig in.
  function _sectionStat(W, id) {
    var acc = W.acceptedSections || {};
    var s = acc[id] || {};
    var pct = 0;
    var preview = '';
    if (id === 'identity') {
      var have = 0, total = 6;
      if (s.mission) have++;
      if (s.vision) have++;
      if (s.values && s.values.length) have++;
      if (s.brand_archetype) have++;
      if (s.positioning_statement) have++;
      if (s.tagline || s.elevator_pitch) have++;
      pct = Math.round((have / total) * 100);
      preview = s.mission || s.tagline || s.elevator_pitch || '';
    } else if (id === 'voice') {
      var v = 0, vt = 4;
      if (s.primary_tone) v++;
      if (s.personality_traits && s.personality_traits.length) v++;
      if (s.dos && s.dos.length) v++;
      if (s.donts && s.donts.length) v++;
      pct = Math.round((v / vt) * 100);
      preview = s.primary_tone || (s.personality_traits || []).slice(0, 3).join(', ');
    } else if (id === 'audience') {
      var a = 0, at = 3;
      if (s.primary_description) a++;
      if (s.segments && s.segments.length) a++;
      if (s.personas && s.personas.length) a++;
      pct = Math.round((a / at) * 100);
      preview = s.primary_description || ((s.segments || []).length + ' segments, ' + ((s.personas || []).length) + ' personas');
    } else if (id === 'offerings') {
      var items = (s.items || []);
      pct = items.length ? 100 : 0;
      preview = items.length ? items.map(function(it) { return it.name || it.title || ''; }).filter(Boolean).slice(0, 3).join(', ') : '';
    } else if (id === 'market') {
      var m = 0, mt = 3;
      if (s.category) m++;
      if (s.positioning) m++;
      if (s.differentiators && s.differentiators.length) m++;
      pct = Math.round((m / mt) * 100);
      preview = s.category ? 'Category: ' + s.category : '';
    } else if (id === 'competitors') {
      var comps = ((acc.market || {}).competitors) || [];
      pct = comps.length ? Math.min(100, comps.length * 25) : 0;
      preview = comps.length
        ? comps.slice(0, 3).map(function(c) { return c.name || ''; }).filter(Boolean).join(', ')
        : '';
    } else if (id === 'content') {
      var cs = acc.content_strategy || s;
      var c = 0, ct = 3;
      if (cs.pillars && cs.pillars.length) c++;
      if (cs.channels && cs.channels.length) c++;
      if (cs.hashtags && cs.hashtags.length) c++;
      pct = Math.round((c / ct) * 100);
      preview = (cs.pillars || []).slice(0, 3).join(', ');
    } else if (id === 'seo') {
      var seo = s;
      var sok = (seo.keywords && seo.keywords.length) ? 50 : 0;
      sok += (seo.metadata && Object.keys(seo.metadata).length) ? 50 : 0;
      pct = sok;
      preview = (seo.keywords || []).slice(0, 5).join(', ');
    } else if (id === 'social') {
      var profiles = (s.profiles || []);
      pct = profiles.length ? Math.min(100, profiles.length * 25) : 0;
      preview = profiles.length + ' profile' + (profiles.length === 1 ? '' : 's');
    }
    return { pct: pct, preview: preview };
  }

  // Card definitions for the dashboard grid. Mirror the v2 mock and the
  // sidebar SECTIONS list but with display-only metadata (icon class
  // colour). Settings is deliberately excluded — it lives in the sidebar
  // bottom slot only.
  var CARDS = [
    { id: 'identity',    label: 'Identity',    icon: 'fingerprint',      iconCls: 'ic-identity' },
    { id: 'voice',       label: 'Voice',       icon: 'comment-dots',     iconCls: 'ic-voice' },
    { id: 'audience',    label: 'Audience',    icon: 'users',            iconCls: 'ic-audience' },
    { id: 'offerings',   label: 'Offerings',   icon: 'box-open',         iconCls: 'ic-offerings' },
    { id: 'market',      label: 'Market',      icon: 'chart-line',       iconCls: 'ic-market' },
    { id: 'competitors', label: 'Competitors', icon: 'crosshairs',       iconCls: 'ic-competitors' },
    { id: 'content',     label: 'Content',     icon: 'pen-nib',          iconCls: 'ic-content' },
    { id: 'seo',         label: 'SEO',         icon: 'magnifying-glass', iconCls: 'ic-seo' },
    { id: 'social',      label: 'Social',      icon: 'share-nodes',      iconCls: 'ic-social' }
  ];

  function _heroHtml(W) {
    var BrandService = window.BrandService;
    var ident = BrandService ? BrandService.getIdentity() : ((W.acceptedSections || {}).identity || {});
    var seed = W.seedContext || {};
    var brand = ident.name || seed.name || 'Your brand';
    var tagline = ident.tagline || ident.elevator_pitch || seed.dump ? (seed.dump || '').split('\n')[0] : '';
    var levelLabels = { 'new': '🌱 New', 'growing': '🚀 Growing', 'deep': '🏛 Established' };
    var phaseChip = levelLabels[W.brandLevel || 'new'] || 'Setup pending';
    var typeChips = (W.brandTypes || []).slice(0, 2);

    // Completion totals across all CARDS.
    var totalPct = 0, totalCount = 0;
    for (var i = 0; i < CARDS.length; i++) {
      var st = _sectionStat(W, CARDS[i].id);
      totalPct += st.pct;
      totalCount++;
    }
    var avgPct = totalCount ? Math.round(totalPct / totalCount) : 0;

    var resumePage = W._lastOpenedPage;
    var resumeField = W._lastOpenedField;
    var resumeChip = '';
    if (resumePage && resumePage !== 'dashboard') {
      resumeChip = '<button class="bpw-dash-resume" data-section="' + _esc(resumePage) + '" type="button">' + _icon('forward') + ' Resume editing → ' + _esc(resumePage) + (resumeField ? ' → ' + _esc(resumeField) : '') + '</button>';
    }

    var html = '<header class="bpw-dash-hero">';
    html += '<div class="bpw-dash-hero-chips">';
    typeChips.forEach(function(t) { html += '<span class="bpw-dash-chip">' + _esc(t) + '</span>'; });
    html += '<span class="bpw-dash-chip bpw-dash-chip-phase">' + _esc(phaseChip) + '</span>';
    html += '</div>';
    html += '<h1 class="bpw-dash-hero-title">' + _esc(brand) + '</h1>';
    if (tagline) html += '<p class="bpw-dash-hero-tagline">' + _esc(_truncate(tagline, 160)) + '</p>';
    if (resumeChip) html += '<div class="bpw-dash-hero-resume">' + resumeChip + '</div>';
    html += '<div class="bpw-dash-hero-stats">';
    html += '<div class="bpw-dash-stat"><div class="n">' + avgPct + '%</div><div class="l">Profile completion</div></div>';
    html += '<div class="bpw-dash-stat"><div class="n">' + CARDS.length + '</div><div class="l">Sections</div></div>';
    html += '</div>';
    html += '</header>';
    return html;
  }

  function _cardHtml(W, card) {
    var st = _sectionStat(W, card.id);
    var status = st.pct >= 100 ? 'Complete' : st.pct > 0 ? (st.pct + '%') : 'Empty';
    var pctClass = st.pct >= 100 ? 'done' : st.pct > 0 ? 'partial' : 'todo';
    var html = '<button class="bpw-dash-card bpw-dash-card--' + pctClass + '" data-section="' + _esc(card.id) + '" type="button">';
    html += '<div class="bpw-dash-card-head">';
    html += '<span class="bpw-dash-card-ic ' + card.iconCls + '">' + _icon(card.icon) + '</span>';
    html += '<span class="bpw-dash-card-title">' + _esc(card.label) + '</span>';
    html += '<span class="bpw-dash-card-status">' + _esc(status) + '</span>';
    html += '</div>';
    if (st.preview) html += '<div class="bpw-dash-card-preview">' + _esc(_truncate(st.preview, 140)) + '</div>';
    html += '<div class="bpw-dash-card-foot">';
    html += '<div class="bpw-dash-card-bar"><div style="width:' + st.pct + '%"></div></div>';
    html += '<span class="bpw-dash-card-pct">' + st.pct + '%</span>';
    html += '</div>';
    html += '</button>';
    return html;
  }

  function renderDetail(W) {
    var html = '<section class="bpw-shell-detail bpw-shell-detail--dashboard" aria-label="Dashboard">';
    html += _heroHtml(W);
    html += '<div class="bpw-dash-grid">';
    for (var i = 0; i < CARDS.length; i++) {
      html += _cardHtml(W, CARDS[i]);
    }
    html += '</div>';
    html += '</section>';
    return html;
  }

  // Section-list is hidden on dashboard via CSS; we still provide a
  // renderList that returns empty so the legacy section-list renderer
  // doesn't crash when it tries to call view.renderList.
  function renderList() { return ''; }

  window._bpwUIViews = window._bpwUIViews || {};
  window._bpwUIViews.dashboard = {
    renderList: renderList,
    renderDetail: renderDetail,
    listMode: 'none'
  };
})();
