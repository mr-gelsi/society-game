(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'society.admin';
  const TIER = { success: 'Success', partial: 'Partial success', fail: 'Fail' };
  let data = null, msg = '', err = '';

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch('/api/admin/' + path, {
      method, headers: { 'content-type': 'application/json', 'x-admin-password': sessionStorage.getItem(KEY) || '' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(j.error || 'Something went wrong.'), { status: res.status });
    return j;
  }

  async function refresh() {
    try { data = await api('overview'); err = ''; }
    catch (e) { if (e.status === 401) { sessionStorage.removeItem(KEY); data = null; } err = e.message; }
    draw();
  }

  function login() {
    $('#app').innerHTML = `<section class="hero"><h1>Teacher controls</h1><p>Set the passcodes that open each event, reveal scores, and adjust points.</p></section>
      ${err ? `<div class="error" role="alert">${esc(err)}</div>` : ''}
      <form id="f-login" class="panel" style="max-width:26rem">
        <div class="field"><label for="pw">Teacher password</label><input id="pw" type="password" autocomplete="current-password" required></div>
        <button class="btn" type="submit">Sign in</button></form>`;
  }

  const stageText = (s) => (s.stage === 'finished' ? 'Finished' : s.stage === 'locked' ? `Locked before Event ${s.current_event}` : `Event ${s.current_event}: ${s.stage}`);

  function describe(x) {
    const r = x.result, d = x.data;
    if (x.step === 'explore') {
      return `<b>Exploration:</b> ${esc(r.title)} <span class="tag ${r.kind === 'good' ? 'success' : 'fail'}">${r.kind === 'good' ? 'Good find' : 'Bad luck'}</span> (code ${esc(r.code)})${r.resolved ? `<br><span class="muted">${esc((r.notes || []).join(' '))} ${r.pointsEarned > 0 ? '+' : ''}${r.pointsEarned} points</span>` : '<br><span class="muted">Waiting for the student to choose.</span>'}`;
    }
    if (x.step === 'activity') {
      const ch = r.changes || {};
      const bits = ['population', 'food', 'infrastructure'].filter((k) => ch[k]).map((k) => `${k} ${ch[k] > 0 ? '+' : ''}${ch[k]}`);
      return `Rolled ${r.dice}${r.bonus ? ` +${r.bonus}` : ''} = ${r.total}. <span class="tag ${r.tier}">${TIER[r.tier]}</span> ${esc(r.outcome)}${bits.length ? `<br><span class="muted">${esc(bits.join(', '))}</span>` : ''}${r.mods?.length ? `<br><span class="muted">Helped by: ${esc(r.mods.join(', '))}</span>` : ''}`;
    }
    const a1 = d.action1 || {}, a2 = r.action2 || {};
    const detail = a1.resource || a1.code || a1.text || (a1.given ? `${a1.given} → ${a1.received}${a1.partner ? ` with ${a1.partner}` : ''}` : '');
    return `<b>Action 1:</b> ${esc(a1.type)} ${esc(detail)}<br>${(r.action1 || []).map((n) => `<span class="muted">${esc(n)}</span>`).join('<br>')}
      ${d.eventChoice ? `<br><b>Choice:</b> ${esc(d.eventChoice)} (matches constitution: ${esc(d.matches)})` : ''}
      <br><b>Action 2:</b> ${esc(a2.label)}, rolled ${a2.dice}${a2.bonus ? ` +${a2.bonus}` : ''} = ${a2.total}. <span class="tag ${a2.tier}">${TIER[a2.tier]}</span>${a2.mods?.length ? `<br><span class="muted">Helped by: ${esc(a2.mods.join(', '))}</span>` : ''}`;
  }

  function societyHtml(s) {
    return `<details data-id="${esc(s.id)}"><summary>${esc(s.name)} <span class="muted">· score ${s.score} · ${esc(stageText(s))}</span></summary><div class="inner">
      <p class="muted">Code <span class="code">${esc(s.code)}</span> · Recorder ${esc(s.recorder || '—')} · ${esc(s.gov_type)} · Goal: ${esc(s.goal)}</p>
      <p>Population <b>${s.population}</b> · Food <b>${s.food}</b> · Infrastructure <b>${s.infrastructure}</b> · Action points <b>${s.points}</b> · Teacher adjustments <b>${s.adjustment}</b></p>
      <p>Buildings: ${Object.entries(s.buildings).map(([k, v]) => `${esc(k)} ×${v}`).join(', ') || 'none yet'}</p>
      <div class="scroll"><table><thead><tr><th>Member</th><th>Job</th><th>Profession item</th><th>Backpack</th></tr></thead><tbody>${s.members.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.job)}</td><td>${esc(m.profession_item)}</td><td>${esc(m.backpack.join(', ') || '—')}</td></tr>`).join('')}</tbody></table></div>
      ${s.submissions.length ? `<div class="scroll"><table style="margin-top:1rem"><thead><tr><th>Event</th><th>Step</th><th>What happened</th></tr></thead><tbody>${s.submissions.map((x) => `<tr><td>${x.event_no}. ${esc(data.eventTitles[x.event_no - 1])}</td><td>${x.step}</td><td>${describe(x)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted" style="margin-top:1rem">No events submitted yet.</p>'}
      ${s.adjustments.length ? `<p style="margin-top:1rem"><b>Adjustments:</b> ${s.adjustments.map((a) => `${a.points > 0 ? '+' : ''}${a.points}${a.note ? ` (${esc(a.note)})` : ''}`).join(', ')}</p>` : ''}
      <form class="row" data-adjust="${esc(s.id)}" style="margin-top:1rem;align-items:end">
        <div><label for="ap-${esc(s.id)}">Add or remove points</label><input id="ap-${esc(s.id)}" name="points" type="number" step="1" required style="max-width:8rem;font-size:1rem"></div>
        <div style="flex:1 1 12rem"><label for="an-${esc(s.id)}">Reason</label><input id="an-${esc(s.id)}" name="note" maxlength="120" placeholder="On task, exploration card…"></div>
        <button class="btn small" type="submit">Apply</button></form>
      <div class="row" style="margin-top:1rem">
        ${s.stage === 'locked' ? `<button class="btn quiet small" data-unlock="${esc(s.id)}">Unlock this society now</button>` : ''}
        <button class="btn quiet small" data-delete="${esc(s.id)}" data-name="${esc(s.name)}">Delete society</button></div>
    </div></details>`;
  }

  function draw() {
    if (!data) return login();
    const open = new Set([...document.querySelectorAll('details[open]')].map((d) => d.dataset.id));
    $('#app').innerHTML = `<section class="hero"><h1>Teacher controls</h1>
      <p>Hand out each event’s passcode when the class is ready. Students who finish an event wait at a locked screen until they enter it.</p></section>
      ${err ? `<div class="error" role="alert">${esc(err)}</div>` : ''}${msg ? `<div class="panel" role="status">${esc(msg)}</div>` : ''}
      <section class="panel"><h2>Event passcodes</h2>
        <div class="scroll"><table><thead><tr><th>Event</th><th>Passcode</th><th></th></tr></thead><tbody>${data.passcodes.map((p) => `<tr>
          <td>${p.event_no}. ${esc(data.eventTitles[p.event_no - 1])}</td>
          <td><input aria-label="Passcode for event ${p.event_no}" id="pc${p.event_no}" value="${esc(p.code)}" maxlength="30" style="max-width:10rem"></td>
          <td><div class="row"><button class="btn small" data-save-pc="${p.event_no}">Save</button><button class="btn quiet small" data-rand-pc="${p.event_no}">New random</button></div></td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel"><h2>Scores</h2>
        <p>${data.reveal ? 'Scores are <b>revealed</b>: students can see their results and the leaderboard.' : 'Scores are <b>hidden</b> from students. The leaderboard page works for you when you enter the teacher password.'}</p>
        <div class="row"><button class="btn" data-reveal="${data.reveal ? 0 : 1}">${data.reveal ? 'Hide scores again' : 'Reveal scores to students'}</button>
        <a class="btn quiet" href="/dashboard.html" style="text-decoration:none;display:inline-flex;align-items:center">Open leaderboard</a>
        <button class="btn quiet" data-refresh>Refresh</button></div></section>
      <section><h2>Societies (${data.societies.length})</h2>${data.societies.map(societyHtml).join('') || '<div class="panel"><p>No societies yet.</p></div>'}</section>
      <section class="panel"><h2>Start a new round</h2><p>Deletes every society, member and score. Passcodes stay.</p>
        <form id="f-reset" class="row" style="align-items:end"><div><label for="rs">Type RESET to confirm</label><input id="rs" autocomplete="off" style="max-width:10rem"></div><button class="btn quiet" type="submit">Delete everything</button></form></section>`;
    document.querySelectorAll('details').forEach((d) => { if (open.has(d.dataset.id)) d.open = true; });
  }

  async function act(fn, ok) {
    try { await fn(); msg = ok || ''; err = ''; await refresh(); }
    catch (e) { err = e.message; msg = ''; draw(); window.scrollTo(0, 0); }
  }

  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === 'f-login') { sessionStorage.setItem(KEY, $('#pw').value); err = ''; refresh(); }
    else if (f.dataset.adjust) {
      const fd = new FormData(f);
      act(() => api('adjust', { method: 'POST', body: { society_id: f.dataset.adjust, points: fd.get('points'), note: fd.get('note') } }), 'Points updated.');
    } else if (f.id === 'f-reset') {
      act(() => api('reset-all', { method: 'POST', body: { confirm: $('#rs').value } }), 'Everything was cleared.');
    }
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (d.savePc) act(() => api('passcode', { method: 'POST', body: { event: d.savePc, code: $('#pc' + d.savePc).value } }), `Passcode for Event ${d.savePc} saved.`);
    else if (d.randPc) act(() => api('passcode', { method: 'POST', body: { event: d.randPc, code: String(1000 + Math.floor(Math.random() * 9000)) } }), `New passcode set for Event ${d.randPc}.`);
    else if (d.reveal !== undefined) act(() => api('reveal', { method: 'POST', body: { on: d.reveal === '1' } }), d.reveal === '1' ? 'Scores are now visible to students.' : 'Scores are hidden again.');
    else if (d.refresh !== undefined) { msg = ''; refresh(); }
    else if (d.unlock) act(() => api('unlock', { method: 'POST', body: { society_id: d.unlock } }), 'Society unlocked.');
    else if (d.delete) { if (confirm(`Delete ${d.name}? This can’t be undone.`)) act(() => api('delete', { method: 'POST', body: { society_id: d.delete } }), `${d.name} was deleted.`); }
  });

  if (sessionStorage.getItem(KEY)) refresh(); else draw();
})();
