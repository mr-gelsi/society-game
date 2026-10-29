(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TIER = { success: 'Success', partial: 'Partial success', fail: 'Fail' };
  const LS = { id: 'society.id', code: 'society.code' };

  const S = { cfg: null, id: null, code: null, soc: null, view: 'home', draft: null, error: '', created: false };

  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (S.code) headers['x-society-code'] = S.code;
    const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
    return data;
  }

  // ---- Boot -----------------------------------------------------------------
  async function boot() {
    try {
      S.cfg = await api('/config');
    } catch (e) {
      S.error = e.message; render(); return;
    }
    S.id = localStorage.getItem(LS.id);
    S.code = localStorage.getItem(LS.code);
    if (S.id && S.code) {
      try { S.soc = (await api(`/society/${S.id}`)).society; S.view = 'game'; }
      catch { leave(false); }
    }
    render();
  }
  function leave(doRender = true) {
    localStorage.removeItem(LS.id); localStorage.removeItem(LS.code);
    S.id = S.code = S.soc = null; S.view = 'home'; S.error = '';
    if (doRender) render();
  }
  function remember(id, code) {
    S.id = id; S.code = code;
    localStorage.setItem(LS.id, id); localStorage.setItem(LS.code, code);
  }

  // ---- Rendering ------------------------------------------------------------
  function render() {
    const app = $('#app');
    const body = S.view === 'setup' ? setupView() : S.soc ? (S.created ? createdView() : gameView()) : homeView();
    app.innerHTML = header() + `<main class="wrap">${S.error ? `<div class="error" role="alert">${esc(S.error)}</div>` : ''}${body}</main>`;
    if (S.view === 'game') syncA1();
    window.scrollTo(0, 0);
  }

  function header() {
    const s = S.soc;
    const track = s ? `<div class="wrap"><ol class="track" aria-label="Event progress">${
      Array.from({ length: S.cfg.eventCount }, (_, i) => {
        const n = i + 1;
        const cls = s.stage === 'finished' || n < s.current_event ? 'done' : n === s.current_event ? 'now' : '';
        return `<li class="${cls}"${cls === 'now' ? ' aria-current="step"' : ''}>${n}</li>`;
      }).join('')}</ol></div>` : '';
    return `<header class="top"><div class="wrap">
      <a class="brand" href="/">Zombie Apocalypse</a>
      ${s ? `<div class="who"><strong>${esc(s.name)}</strong><span class="muted">Society code <span class="code">${esc(s.code)}</span></span></div>` : ''}
      <nav><a href="/dashboard.html">Leaderboard</a>${s ? '<button class="btn quiet small" data-act="leave">Leave</button>' : ''}</nav>
    </div>${track}</header>`;
  }

  function homeView() {
    return `<section class="hero">
      <h1>Survive the outbreak</h1>
      <p>Your society has to survive and thrive. Each event you make decisions, roll your dice, and see how your people, jobs and supplies hold up.</p>
    </section>
    <div class="grid2">
      <form class="panel" id="f-login">
        <h2>Return to your society</h2>
        <div class="field"><label for="ln">Society name</label><input id="ln" name="name" required autocomplete="off"></div>
        <div class="field"><label for="lc">Society code</label><input id="lc" name="code" required autocomplete="off" placeholder="WOLF-1234"></div>
        <button class="btn" type="submit">Open my society</button>
      </form>
      <div class="panel">
        <h2>Start a new society</h2>
        <p>Only your <b>record keeper</b> does this, once. You’ll name your society, list your members, and write your constitution. Then you’ll get a code to come back with.</p>
        <button class="btn" data-act="start-setup">Start a society</button>
      </div>
    </div>`;
  }

  // ---- Setup (census + constitution) ----------------------------------------
  const blankMember = () => ({ name: '', job: '', prof: '', bp: ['', '', ''] });
  function newDraft() {
    return { name: '', recorder: '', gov: '', goal: '', members: Array.from({ length: 4 }, blankMember), editing: false };
  }
  function draftFrom(soc) {
    return {
      name: soc.name, recorder: soc.recorder || '', gov: soc.gov_type, goal: soc.goal, editing: true,
      members: soc.members.map((m) => ({ name: m.name, job: m.job, prof: m.profession_item, bp: [0, 1, 2].map((i) => m.backpack[i] || '') })),
    };
  }
  const opts = (list, sel, ph) => `<option value="">${esc(ph)}</option>` + list.map((x) => `<option${x === sel ? ' selected' : ''}>${esc(x)}</option>`).join('');

  function memberHtml(m, i) {
    const c = S.cfg;
    return `<fieldset class="member"><legend>Member ${i + 1}</legend>
      <div class="cols">
        <div><label for="mn${i}">Name</label><input id="mn${i}" data-m="${i}" data-f="name" value="${esc(m.name)}" maxlength="40" autocomplete="off"></div>
        <div><label for="mj${i}">Job category</label><select id="mj${i}" data-m="${i}" data-f="job">${opts(c.jobs, m.job, 'Choose a job')}</select></div>
        <div><label for="mp${i}">Profession item</label><select id="mp${i}" data-m="${i}" data-f="prof">${opts(c.itemCategories, m.prof, 'Choose an item type')}</select></div>
      </div>
      <p class="hint" style="margin:.75rem 0 .25rem">Backpack items (up to 3)</p>
      <div class="cols">${[0, 1, 2].map((k) => `<div><label for="mb${i}-${k}">Item ${k + 1}</label><select id="mb${i}-${k}" data-m="${i}" data-f="bp" data-i="${k}">${opts(c.backpackItems, m.bp[k], 'No item')}</select></div>`).join('')}</div>
      ${S.draft.members.length > 1 ? `<div style="margin-top:.75rem"><button type="button" class="btn quiet small" data-act="remove-member" data-i="${i}">Remove member ${i + 1}</button></div>` : ''}
    </fieldset>`;
  }
  function membersHtml() {
    const d = S.draft;
    return d.members.map(memberHtml).join('') +
      (d.members.length < S.cfg.maxMembers ? '<button type="button" class="btn quiet" data-act="add-member">Add another member</button>' : `<p class="muted">That’s the maximum of ${S.cfg.maxMembers} members.</p>`);
  }
  function setupView() {
    const d = S.draft, c = S.cfg;
    return `<h1 style="font-size:clamp(2rem,5vw,3rem)">${d.editing ? 'Edit your census' : 'Start your society'}</h1>
    <form id="f-setup" novalidate>
      <section class="panel">
        <h2>Your society</h2>
        <div class="grid2">
          <div class="field"><label for="sn">Name of your society</label><input id="sn" data-k="name" value="${esc(d.name)}" maxlength="40" required autocomplete="off"></div>
          <div class="field"><label for="rk">Record keeper’s name</label><input id="rk" data-k="recorder" value="${esc(d.recorder)}" maxlength="40" autocomplete="off"></div>
        </div>
      </section>
      <section class="panel">
        <h2>Census</h2>
        <p class="hint">List each member, their job, their profession item, and the items in their backpack. Blank rows are skipped.</p>
        <div id="members">${membersHtml()}</div>
      </section>
      <section class="panel">
        <h2>Your constitution</h2>
        <div class="field"><label for="gv">Your government type</label><select id="gv" data-k="gov">${opts(c.govTypes, d.gov, 'Choose a government')}</select></div>
        <div class="field"><label for="gl">Goal of your society</label><textarea id="gl" data-k="goal" maxlength="200">${esc(d.goal)}</textarea></div>
      </section>
      <div class="row">
        <button class="btn" type="submit">${d.editing ? 'Save changes' : 'Create my society'}</button>
        <button class="btn quiet" type="button" data-act="cancel-setup">Cancel</button>
      </div>
    </form>`;
  }

  function createdView() {
    const s = S.soc;
    return `<section class="panel">
      <h1 style="font-size:clamp(2rem,5vw,3rem)">${esc(s.name)} is on the map</h1>
      <p>This is your society code. Write it down. Your record keeper needs it, along with your society name, to come back on any Chromebook.</p>
      <div class="bigcode" aria-label="Society code">${esc(s.code)}</div>
      <button class="btn" data-act="continue">I wrote it down</button>
    </section>`;
  }

  // ---- Game screens ---------------------------------------------------------
  function gameView() {
    const s = S.soc;
    if (s.stage === 'locked') return lockedView();
    if (s.stage === 'decisions') return decisionsView();
    if (s.stage === 'explore') return exploreView();
    if (s.stage === 'activity') return activityView();
    return finishedView();
  }

  function lockedView() {
    const s = S.soc, n = s.current_event;
    const done = n > 1;
    return `<section class="panel">
      <h2>${done ? `Event ${n - 1} is recorded` : 'Your society is ready'}</h2>
      <p>${done ? 'Your decisions and dice rolls are saved. ' : ''}<b>Event ${n} is locked.</b> Wait for your teacher to give the class the passcode, then enter it here.</p>
      <form id="f-unlock" class="row" style="align-items:end">
        <div class="field" style="margin:0;flex:1 1 12rem;max-width:18rem"><label for="pc">Passcode for Event ${n}</label><input id="pc" name="passcode" required autocomplete="off"></div>
        <button class="btn" type="submit">Unlock Event ${n}</button>
      </form>
    </section>
    ${s.canEditSetup ? `<section class="panel"><h3>Need to fix your census?</h3><p>You can edit your members and constitution until Event 1 begins.</p><button class="btn quiet" data-act="edit-setup">Edit census</button></section>` : ''}
    <section class="panel"><h3>Your society</h3>${censusTable(s)}<p style="margin-top:1rem"><b>Government:</b> ${esc(s.gov_type)}<br><b>Goal:</b> ${esc(s.goal)}</p></section>`;
  }

  function censusTable(s) {
    return `<div class="scroll"><table><thead><tr><th>Member</th><th>Job</th><th>Profession item</th><th>Backpack</th></tr></thead><tbody>${
      s.members.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.job)}</td><td>${esc(m.profession_item)}</td><td>${esc(m.backpack.join(', ') || '—')}</td></tr>`).join('')
    }</tbody></table></div>`;
  }

  function dispatch(ev, label) {
    return `<div class="dispatch"><p class="muted" style="margin:0">Event ${ev.n}${label ? `: ${esc(label)}` : ''}</p>
      <h2>${esc(ev.title)}</h2><p style="margin:0">${esc(ev.description)}</p>${ev.note ? `<p class="note">${esc(ev.note)}</p>` : ''}</div>`;
  }

  function decisionsView() {
    const s = S.soc, ev = s.event, c = S.cfg;
    const a1 = c.action1.map((o, i) => `<label class="choice"><input type="radio" name="a1" value="${o.id}"${i === 0 ? ' required' : ''}><span class="name">${esc(o.label)}</span><span class="desc">${esc(o.blurb)}</span></label>`).join('');
    const choice = ev.choice ? `
      <section class="panel"><h2>Your society’s decision</h2>
        <p class="label">${esc(ev.choice.prompt)}</p>
        <div class="choices">${ev.choice.options.map((o, i) => `<label class="choice"><input type="radio" name="eventChoice" value="${o.id}"${i === 0 ? ' required' : ''}><span class="name">${esc(o.label)}</span></label>`).join('')}</div>
        <p class="label">Does this choice match your constitution?</p>
        <div class="row" style="margin-bottom:.5rem">
          <label class="choice" style="margin:0"><input type="radio" name="matches" value="yes" required><span class="name">Yes</span></label>
          <label class="choice" style="margin:0"><input type="radio" name="matches" value="no"><span class="name">No</span></label>
        </div>
        <p class="hint" style="margin:0">If it doesn’t match, choose Amend Constitution for Action 1 and describe the change.</p>
      </section>` : '';
    return `${dispatch(ev, 'Decisions')}
    <form id="f-decisions">
      <section class="panel">
        <h2>Action 1: Resources</h2>
        <p class="hint">You have 3 minutes to choose.</p>
        <div class="choices">${a1}</div>
        <div class="sub" data-for="gather" hidden><label for="res">Which resource are you gathering?</label>
          <select id="res" name="resource" data-req>${opts(c.resources, '', 'Choose a resource')}</select></div>
        <div class="sub" data-for="explore" hidden><label for="xc">Code from your Exploration card</label>
          <input id="xc" name="code" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" data-req>
          <p class="hint" style="margin:.5rem 0 0">Draw a card, type its code, and you’ll see what you found after you submit. Each code works once for your society.</p></div>
        <div class="sub" data-for="barter" hidden>
          <div class="field"><label for="bp">Trading with which society? <span class="hint">(optional)</span></label><input id="bp" name="partner" maxlength="40" autocomplete="off"></div>
          <div class="grid2">
            <div><label for="bg">Item you gave</label><select id="bg" name="given" data-req>${opts(c.itemCategories, '', 'Choose an item type')}</select></div>
            <div><label for="br">Item you received</label><select id="br" name="received" data-req>${opts(c.itemCategories, '', 'Choose an item type')}</select></div>
          </div></div>
        <div class="sub" data-for="amend" hidden><label for="at">What are you changing in your constitution?</label>
          <textarea id="at" name="text" maxlength="300" data-req></textarea></div>
      </section>
      ${choice}
      <section class="panel">
        <h2>Action 2: Grow your society</h2>
        <p class="hint">You have 2 minutes to choose. Roll your real dice, then enter the number.</p>
        <div class="field"><label for="a2">What are you doing?</label>
          <select id="a2" name="build" required>${`<option value="">Choose an action</option>` + c.builds.map((b) => `<option value="${b.id}">${esc(b.label)}: ${esc(b.blurb)}</option>`).join('')}</select></div>
        <div class="field"><label for="d2">Dice roll <span class="hint">(1 to 6)</span></label>
          <input id="d2" name="dice" type="number" min="1" max="6" step="1" inputmode="numeric" required></div>
      </section>
      <button class="btn" type="submit">Submit decisions</button>
    </form>`;
  }

  function exploreView() {
    const s = S.soc, x = s.explore;
    if (!x) return '<section class="panel"><p>Loading your exploration…</p></section>';
    const result = x.resolved ? `<ul class="stakes">${x.notes.map((n) => `<li class="${x.kind === 'good' ? 'success' : 'fail'}">${esc(n)}</li>`).join('')}</ul>
        <button class="btn" data-act="continue-explore">Continue to the event activity</button>` : '';
    const pick = !x.resolved && x.pick ? `<form id="f-explore"><p class="label">${esc(x.pick.prompt)}</p>
        <div class="choices">${x.pick.options.map((o, i) => `<label class="choice"><input type="radio" name="choice" value="${esc(o.id)}"${i === 0 ? ' required' : ''}><span class="name">${esc(o.label)}</span></label>`).join('')}</div>
        <button class="btn" type="submit">Confirm</button></form>` : '';
    return `<div class="dispatch"><p class="muted" style="margin:0">Event ${s.current_event}: Exploration</p>
      <h2>${esc(x.title)}</h2><p style="margin:0">${esc(x.text)}</p></div>
      <section class="panel"><h2>${x.resolved ? 'What happened' : 'Make your choice'}</h2>${result}${pick}</section>`;
  }

  function activityView() {
    const s = S.soc, ev = s.event, a = s.activity;
    const chosen = ev.choice && ev.choice.options.find((o) => o.id === s.eventChoice);
    return `${dispatch(ev, 'Activity')}
    <section class="panel">
      <h2>${esc(a.title)}</h2>
      ${chosen ? `<p class="muted">Your society chose: ${esc(chosen.label)}</p>` : ''}
      <p>${esc(a.prompt)}</p>
      <ul class="stakes">
        <li class="fail"><b>Fail</b>${esc(a.fail)}</li>
        <li class="partial"><b>Partial success</b>${esc(a.partial)}</li>
        <li class="success"><b>Success</b>${esc(a.success)}</li>
      </ul>
      <p class="muted">What helps: ${esc(a.helps)}. Send one representative at a time to roll.</p>
      <form id="f-activity" class="row" style="align-items:end">
        <div class="field" style="margin:0"><label for="d3">Dice roll <span class="hint">(1 to 6)</span></label>
          <input id="d3" name="dice" type="number" min="1" max="6" step="1" inputmode="numeric" required></div>
        <button class="btn" type="submit">Submit roll</button>
      </form>
    </section>`;
  }

  function finishedView() {
    const s = S.soc;
    const head = `<section class="panel"><h2>Your survival record is complete</h2>
      <p>All ${S.cfg.eventCount} events are recorded. ${s.reveal ? '' : 'Scores stay hidden until your teacher reveals them.'}</p>
      <div class="row"><button class="btn quiet" data-act="refresh">Check for results</button><a class="btn quiet" href="/dashboard.html" style="text-decoration:none;display:inline-flex;align-items:center">Leaderboard</a></div></section>`;
    if (!s.reveal) return head;
    const acts = (s.results || []).filter((r) => r.step === 'activity');
    return head + `<section class="panel"><h2>Final standing</h2>
      <p>Score <b>${s.stats.score}</b> · Population <b>${s.stats.population}</b> · Food <b>${s.stats.food}</b> · Infrastructure <b>${s.stats.infrastructure}</b></p>
      <div class="scroll"><table><thead><tr><th>Event</th><th>Roll</th><th>Result</th></tr></thead><tbody>${acts.map((r) => `<tr>
        <td>${r.event_no}. ${esc(r.title)}</td><td>${r.result.dice}${r.result.bonus ? ` +${r.result.bonus}` : ''}</td>
        <td><span class="tag ${r.result.tier}">${TIER[r.result.tier]}</span> ${esc(r.result.outcome)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  // Show only the sub-panel for the chosen Action 1 and require only its fields.
  function syncA1() {
    const form = $('#f-decisions');
    if (!form) return;
    const sel = (form.querySelector('input[name=a1]:checked') || {}).value;
    form.querySelectorAll('.sub').forEach((p) => {
      const on = p.dataset.for === sel;
      p.hidden = !on;
      p.querySelectorAll('[data-req]').forEach((el) => { el.required = on; });
    });
  }

  // ---- Events ---------------------------------------------------------------
  document.addEventListener('input', onField);
  document.addEventListener('change', (e) => { onField(e); if (e.target.name === 'a1') syncA1(); });
  function onField(e) {
    const t = e.target, d = S.draft;
    if (!d || S.view !== 'setup') return;
    if (t.dataset.k) d[t.dataset.k] = t.value;
    else if (t.dataset.m !== undefined) {
      const m = d.members[+t.dataset.m];
      if (t.dataset.f === 'bp') m.bp[+t.dataset.i] = t.value; else m[t.dataset.f] = t.value;
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    S.error = '';
    if (act === 'leave') { if (confirm('Leave this society on this Chromebook? You can return with your society name and code.')) leave(); }
    else if (act === 'start-setup') { S.draft = newDraft(); S.view = 'setup'; render(); }
    else if (act === 'edit-setup') { S.draft = draftFrom(S.soc); S.view = 'setup'; render(); }
    else if (act === 'cancel-setup') { S.view = S.soc ? 'game' : 'home'; render(); }
    else if (act === 'add-member') { S.draft.members.push(blankMember()); $('#members').innerHTML = membersHtml(); }
    else if (act === 'remove-member') { S.draft.members.splice(+b.dataset.i, 1); $('#members').innerHTML = membersHtml(); }
    else if (act === 'continue') { S.created = false; render(); }
    else if (act === 'continue-explore') run(async () => { S.soc = (await api(`/society/${S.id}/continue`, { method: 'POST' })).society; });
    else if (act === 'refresh') run(async () => { S.soc = (await api(`/society/${S.id}`)).society; });
  });

  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, fd = new FormData(f);
    S.error = '';
    if (f.id === 'f-login') run(async () => {
      const r = await api('/login', { method: 'POST', body: { name: fd.get('name'), code: fd.get('code') } });
      remember(r.id, r.code);
      S.soc = (await api(`/society/${r.id}`)).society; S.view = 'game';
    });
    else if (f.id === 'f-setup') run(async () => {
      const d = S.draft;
      const body = {
        name: d.name, recorder: d.recorder, gov_type: d.gov, goal: d.goal,
        members: d.members.map((m) => ({ name: m.name, job: m.job, profession_item: m.prof, backpack: m.bp.filter(Boolean) })),
      };
      if (d.editing) { S.soc = (await api(`/society/${S.id}/setup`, { method: 'PUT', body })).society; S.view = 'game'; }
      else {
        const r = await api('/societies', { method: 'POST', body });
        remember(r.id, r.code);
        S.soc = (await api(`/society/${r.id}`)).society; S.view = 'game'; S.created = true;
      }
    });
    else if (f.id === 'f-unlock') run(async () => {
      S.soc = (await api(`/society/${S.id}/unlock`, { method: 'POST', body: { passcode: fd.get('passcode') } })).society;
    });
    else if (f.id === 'f-decisions') run(async () => {
      const body = {
        action1: { type: fd.get('a1'), resource: fd.get('resource'), code: fd.get('code'), partner: fd.get('partner'), given: fd.get('given'), received: fd.get('received'), text: fd.get('text') },
        action2: { build: fd.get('build'), dice: fd.get('dice') },
        eventChoice: fd.get('eventChoice'), matches: fd.get('matches'),
      };
      S.soc = (await api(`/society/${S.id}/decisions`, { method: 'POST', body })).society;
    });
    else if (f.id === 'f-explore') run(async () => {
      S.soc = (await api(`/society/${S.id}/explore`, { method: 'POST', body: { choice: fd.get('choice') } })).society;
    });
    else if (f.id === 'f-activity') run(async () => {
      S.soc = (await api(`/society/${S.id}/activity`, { method: 'POST', body: { dice: fd.get('dice') } })).society;
    });
  });

  async function run(fn) {
    const btn = document.querySelector('form button[type=submit]');
    if (btn) btn.disabled = true;
    try { await fn(); render(); }
    catch (err) { S.error = err.message; showError(); if (btn) btn.disabled = false; }
  }
  // Show an error without rebuilding the page, so nothing the student typed is lost.
  function showError() {
    let el = $('main .error');
    if (!el) { el = document.createElement('div'); el.className = 'error'; el.setAttribute('role', 'alert'); $('main').prepend(el); }
    el.textContent = S.error;
    window.scrollTo(0, 0);
  }

  boot();
})();
