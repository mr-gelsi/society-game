(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'society.admin';
  let timer;

  async function load() {
    const headers = {};
    const pw = sessionStorage.getItem(KEY);
    if (pw) headers['x-admin-password'] = pw;
    try {
      const res = await fetch('/api/leaderboard', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load the leaderboard.');
      draw(data);
    } catch (e) {
      $('#app').innerHTML = `<div class="error" role="alert">${esc(e.message)}</div>`;
    }
  }

  function draw(d) {
    if (!d.visible) {
      if ($('#f-pw')) return; // don't wipe a password that's being typed
      $('#app').innerHTML = `<section class="hero"><h1>Scores are hidden</h1>
        <p>Scores stay secret until the end of the game. Your teacher can reveal them to the class, or unlock this page with the teacher password.</p></section>
        <form id="f-pw" class="panel" style="max-width:26rem">
          <div class="field"><label for="pw">Teacher password</label><input id="pw" type="password" autocomplete="current-password" required></div>
          <button class="btn" type="submit">Show leaderboard</button></form>`;
      return;
    }
    const list = d.societies;
    const top = Math.max(1, ...list.map((s) => s.score));
    const stage = (s) => (s.stage === 'finished' ? 'Finished' : s.stage === 'locked' ? `Waiting for Event ${s.event}` : `On Event ${s.event}`);
    $('#app').innerHTML = `<section class="hero"><h1>Who is surviving?</h1>
      <p>${d.reveal ? 'Scores are revealed.' : 'Teacher view: students can’t see this page until you reveal scores.'}
      ${list.length ? `Updates every few seconds.` : ''}</p></section>
      ${list.length ? `<ol class="board">${list.map((s, i) => `<li>
        <span class="rank">${i + 1}</span>
        <span class="name">${esc(s.name)}</span>
        <span class="score">${s.score}</span>
        <span class="bar"><span style="width:${Math.max(2, Math.round((s.score / top) * 100))}%"></span></span>
        <span class="stats"><span>Population ${s.population}</span><span>Food ${s.food}</span><span>Infrastructure ${s.infrastructure}</span><span>${s.members} members</span><span>${s.buildings} buildings</span><span>${stage(s)}</span></span>
      </li>`).join('')}</ol>` : '<div class="panel"><p>No societies yet. They’ll appear here as students create them.</p></div>'}`;
  }

  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'f-pw') return;
    e.preventDefault();
    sessionStorage.setItem(KEY, $('#pw').value);
    load();
  });

  load();
  timer = setInterval(() => { if (!document.hidden) load(); }, 8000);
})();
