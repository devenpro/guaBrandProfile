/* Populate the 9-step rail. Each mock declares `data-current` and gets a label. */
(function () {
  const STEPS = [
    { n: '1',  l: 'Basics' },
    { n: '2',  l: 'Discovery' },
    { n: '2b', l: 'Follow-ups' },
    { n: '3',  l: 'Identity' },
    { n: '4',  l: 'Voice' },
    { n: '5',  l: 'Audience' },
    { n: '6',  l: 'Offerings' },
    { n: '7',  l: 'Market' },
    { n: '8',  l: 'Competitors' }
  ];
  document.querySelectorAll('.wiz-rail-steps').forEach(rail => {
    const current = rail.getAttribute('data-current');
    let html = '';
    let reachedCurrent = false;
    STEPS.forEach(s => {
      let cls = '';
      if (s.n === current) { cls = 'current'; reachedCurrent = true; }
      else if (!reachedCurrent) cls = 'done';
      html += `<div class="step ${cls}"><span class="n">Step ${s.n}</span><span>${s.l}</span></div>`;
    });
    rail.innerHTML = html;
  });

  /* Phase pill toggle */
  document.querySelectorAll('.phase-row').forEach(group => {
    group.addEventListener('click', e => {
      const pill = e.target.closest('.phase-pill');
      if (!pill) return;
      group.querySelectorAll('.phase-pill').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
    });
  });

  /* Review card click-to-edit (visual only) */
  document.querySelectorAll('.review-card').forEach(card => {
    const editBtn = card.querySelector('[data-act="edit"]');
    if (editBtn) editBtn.addEventListener('click', () => card.classList.toggle('editing'));
  });
})();
