/* Readline UI */
(function () {
  'use strict';
  const { today, addDays, diff, parse, dow, uid, int, validDate } = RL;
  let S = RL.load();
  let C = RL.makeCalc(S);
  const persist = () => RL.save(S);
  persist();

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const fmtD = s => { const d = parse(s); return MON[d.getMonth()] + ' ' + d.getDate(); };
  const stamp = s => { const d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()].toUpperCase(); };
  const fmtMin = m => (m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''));
  const rel = n => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? 'in ' + n + ' days' : -n + ' days ago');
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const nf = n => Number(n).toLocaleString('en-US');

  const TYPES = {
    library: { label: 'Library loan', short: 'Library' },
    club: { label: 'Book club', short: 'Book club' },
    class: { label: 'Class', short: 'Class' },
    goal: { label: 'Personal goal', short: 'Goal' }
  };
  const COLORS = ['#C2410C', '#2F5D8A', '#0F766E', '#7B4B6B', '#B8860B', '#8B5E3C', '#9F1239', '#4D7C5B'];

  const IC = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    flame: '<path d="M12 2.5c.8 3 4.5 5 4.5 10a4.5 4.5 0 0 1-9 0c0-2.2 1-3.6 2.2-4.6.1 1.8.9 3 2 3.3-.5-2.8-.4-5.6.3-8.7z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    alert: '<path d="M12 3.5l9.5 17h-19z"/><path d="M12 10v4.5M12 17.6v.1"/>',
    share: '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.4 13.3l7.2 4.4M15.6 6.3l-7.2 4.4"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    renew: '<path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9L20.5 8.5M20.5 3.5v5h-5M20.5 12a8.5 8.5 0 0 1-14.6 5.9L3.5 15.5M3.5 20.5v-5h5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20v-3"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    scale: '<path d="M12 3v18M5 21h14M4 7h16M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>'
  };
  const ic = (n, sz) => `<svg class="ic" viewBox="0 0 24 24" width="${sz || 20}" height="${sz || 20}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

  // ---------- Native bridge ----------
  const A = window.Android;
  const vibrate = ms => { try { A && A.vibrate && A.vibrate(ms); } catch (e) { /* no-op */ } try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* no-op */ } };
  let toastT = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function shareText(text) {
    if (A && A.share) { try { A.share(text); return; } catch (e) { /* fall back */ } }
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    copyText(text, 'Summary copied to clipboard');
  }
  function copyText(text, okMsg) {
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(okMsg || 'Copied'); } catch (e) { toast('Select the text and copy it manually'); }
      ta.remove();
    };
    try { navigator.clipboard.writeText(text).then(() => toast(okMsg || 'Copied'), fallback); } catch (e) { fallback(); }
  }

  // ---------- Theme ----------
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    const th = S.settings.theme === 'system' ? (mq && mq.matches ? 'dark' : 'light') : S.settings.theme;
    document.documentElement.dataset.theme = th;
    const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', th === 'dark' ? '#1C1917' : '#F6F1E7');
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);

  // ---------- Helpers ----------
  const active = () => S.books.filter(b => b.status === 'active');
  const byId = id => S.books.find(b => b.id === id);
  const sortActive = (list, t) => list.slice().sort((a, b) => (C.effEnd(a, t) < C.effEnd(b, t) ? -1 : 1));
  function prevRD(t) {
    let d = addDays(t, -1);
    for (let i = 0; i < 7; i++) { if (S.settings.readingDays[dow(d)]) return d; d = addDays(d, -1); }
    return addDays(t, -1);
  }
  function streakNow() {
    const st = S.streak, t = today();
    if (!st.lastHitDate) return 0;
    if (st.lastHitDate === t) return st.current;
    return st.lastHitDate >= prevRD(t) ? st.current : 0;
  }
  function checkHit() {
    const t = today(), pc = C.pace(t);
    let any = false, all = true;
    for (const b of active()) { const i = C.info(b, t, pc); if (i.target > 0) { any = true; if (i.remaining > 0) all = false; } }
    if (any && all && S.streak.lastHitDate !== t) {
      const cont = S.streak.lastHitDate && S.streak.lastHitDate >= prevRD(t);
      S.streak.current = cont ? S.streak.current + 1 : 1;
      S.streak.best = Math.max(S.streak.best, S.streak.current);
      S.streak.lastHitDate = t;
      S.streak.hitDates = S.streak.hitDates.filter(d => d >= addDays(t, -60) && d !== t).concat(t);
      return true;
    }
    return false;
  }
  const lastDeadline = b => b.deadline;
  const onTime = b => b.status === 'finished' && b.finishedAt && b.finishedAt <= lastDeadline(b);
  const chipCls = k => ({ ok: 'ok', ahead: 'ok', behind: 'warn', imp: 'bad', over: 'bad', done: 'ok' }[k] || '');

  // ---------- Layers (pages / sheets / dialogs) ----------
  const layers = [];
  let lastPush = 0;
  function pushLayer(kind, build, opts) {
    opts = opts || {};
    lastPush = Date.now();
    const el = document.createElement('div');
    el.className = 'layer ' + kind;
    el.innerHTML = kind === 'page' ? '<div class="panel"></div>' : '<div class="scrim" data-act="close"></div><div class="panel"></div>';
    $('#layers').appendChild(el);
    const L = Object.assign({ kind, el, panel: el.querySelector('.panel'), build }, opts);
    L.refresh = () => {
      if (L.static) return;
      const y = L.panel.scrollTop; L.panel.innerHTML = L.build(); L.panel.scrollTop = y; if (L.after) L.after(L);
    };
    L.panel.innerHTML = build();
    if (L.after) L.after(L);
    layers.push(L);
    void el.offsetWidth; el.classList.add('in');
    return L;
  }
  function closeTop() {
    const L = layers.pop(); if (!L) return;
    if (L.onClose) L.onClose();
    L.el.classList.remove('in'); L.el.classList.add('out');
    setTimeout(() => L.el.remove(), 280);
  }
  function closeAll() { while (layers.length) closeTop(); }

  function dialog(o) {
    const acts = o.actions || [{ label: 'OK', kind: 'primary' }];
    const L = pushLayer('dialog', () => `
      <div class="dlg">
        ${o.icon ? `<div class="dlg-ic ${o.tone || ''}">${ic(o.icon, 26)}</div>` : ''}
        <h3>${o.title}</h3>
        ${o.body ? `<div class="dlg-body">${o.body}</div>` : ''}
        <div class="dlg-actions">${acts.map((a, i) => `<button class="btn ${a.kind || 'ghost'}" data-dlg="${i}">${a.label}</button>`).join('')}</div>
      </div>`, { static: true });
    L.panel.addEventListener('click', e => {
      const b = e.target.closest('[data-dlg]'); if (!b || L.done) return;
      L.done = true;
      const a = acts[+b.dataset.dlg]; closeTop(); if (a.fn) a.fn();
    });
    return L;
  }

  // ---------- Render ----------
  let tab = 'today';
  function render() {
    applyTheme();
    const sc = $('#screen');
    const y = sc.scrollTop;
    sc.innerHTML = ({ today: vToday, plan: vPlan, shelf: vShelf, settings: vSettings })[tab]();
    sc.scrollTop = y;
    document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('#fab').classList.toggle('hide', !(tab === 'today' || tab === 'plan'));
    layers.forEach(L => L.refresh());
  }
  function setTab(t) {
    if (t === tab) { $('#screen').scrollTo({ top: 0, behavior: 'smooth' }); return; }
    tab = t; $('#screen').scrollTop = 0; render();
    const sc = $('#screen'); sc.classList.remove('fade'); void sc.offsetWidth; sc.classList.add('fade');
  }

  // ---------- Today ----------
  function targetBlock(b, i, big) {
    if (i.left <= 0) {
      return `<div class="tgt done"><div class="tgt-main"><div class="lbl">Last page reached</div><div class="big">${ic('check', 26)} Done</div></div>
        <button class="btn primary sm" data-act="finish" data-id="${b.id}">Mark finished</button></div>`;
    }
    if (i.restDay) {
      return `<div class="tgt rest"><div class="tgt-main"><div class="lbl">Rest day</div><div class="mid">No pages planned</div>
        ${i.next ? `<div class="sub">Next: ${DAY[dow(i.next.date)]} · ${i.next.planned} pages</div>` : ''}</div>
        <button class="btn soft sm" data-act="log" data-id="${b.id}">${ic('plus', 18)} Log</button></div>`;
    }
    if (i.remaining === 0) {
      const tm = i.plan[1] && i.plan[1].planned ? `Tomorrow ≈ ${i.plan[1].planned} pages` : (i.next ? `Next: ${DAY[dow(i.next.date)]} · ${i.next.planned} pages` : 'Read ahead or rest');
      return `<div class="tgt met"><div class="tgt-main"><div class="lbl">Today's target met</div><div class="big ok-ink">${ic('check', 26)} p. ${b.currentPage}</div><div class="sub">${tm}</div></div>
        <button class="btn soft sm" data-act="log" data-id="${b.id}">${ic('plus', 18)} Log</button></div>`;
    }
    const time = i.minutes ? `≈ ${fmtMin(i.minutes)}` : '';
    const goal = i.seg && i.seg.cp ? `<div class="sub">toward p. ${i.seg.cp.page} by ${fmtD(i.seg.cp.date)}</div>` : '';
    return `<div class="tgt"><div class="tgt-main"><div class="lbl">Read to</div><div class="big ${big ? 'xl' : ''}">p.&nbsp;${i.readTo}</div>${goal}</div>
      <div class="tgt-meta"><b>${i.remaining}</b> pages${i.remaining !== i.target ? `<span> of ${i.target}</span>` : ''}${time ? `<br><span class="t">${time}</span>` : ''}</div>
      <button class="btn primary sm" data-act="log" data-id="${b.id}">${ic('plus', 18)} Log</button></div>`;
  }

  function bookCard(b, t, pc) {
    const i = C.info(b, t, pc);
    const due = i.daysLeft;
    const cp = (b.checkpoints || []).filter(c => c.date >= t && c.page > b.currentPage).sort((x, y) => (x.date < y.date ? -1 : 1))[0];
    return `<article class="card book" data-act="detail" data-id="${b.id}" style="--bc:${esc(b.color)}">
      <div class="spine"></div>
      <div class="bk-body">
        <div class="bk-top"><span class="type">${TYPES[b.type].short}</span><span class="stamp ${due < 0 ? 'late' : due <= 2 ? 'soon' : ''}">DUE ${stamp(b.deadline)}</span></div>
        <h3 class="bk-title">${esc(b.title)}</h3>
        ${b.author ? `<div class="bk-author">${esc(b.author)}</div>` : ''}
        <div class="prog"><i style="width:${Math.min(100, i.pct)}%"></i>${i.readTo > b.currentPage ? `<s style="left:${Math.min(100, i.pct)}%;width:${Math.min(100 - i.pct, Math.round(100 * (i.readTo - b.currentPage) / (b.endPage - b.startPage + 1)))}%"></s>` : ''}</div>
        <div class="prog-meta"><span>p. ${b.currentPage} of ${b.endPage}</span><span>${i.pct}% · ${due >= 0 ? rel(due).replace('in ', '') + (due > 1 ? ' left' : '') : 'overdue'}</span></div>
        ${targetBlock(b, i)}
        <div class="chips"><span class="chip ${chipCls(i.status.key)}">${i.status.label}</span>
          ${cp ? `<span class="chip">${ic('flag', 14)} p. ${cp.page} · ${fmtD(cp.date)}</span>` : ''}
          ${S.timer && S.timer.bookId === b.id ? `<span class="chip live">${ic('clock', 14)} <span data-timer>0:00</span></span>` : ''}
        </div>
      </div>
    </article>`;
  }

  function vToday() {
    const t = today(), pc = C.pace(t), list = sortActive(active(), t);
    const infos = list.map(b => C.info(b, t, pc));
    const totalTarget = infos.reduce((a, i) => a + i.target, 0);
    const left = infos.reduce((a, i) => a + i.remaining, 0);
    const doneToday = Math.max(0, totalTarget - left);
    const mins = pc.ppm && left ? Math.round(left / pc.ppm) : null;
    const sim = C.simulate(list, t, pc);
    const st = streakNow();
    const d = parse(t);
    let hero;
    if (!list.length) hero = '';
    else if (totalTarget === 0) hero = `<section class="hero calm"><div class="hero-l"><div class="hero-num">Rest</div><div class="hero-sub">No pages planned today. Enjoy it — or read ahead.</div></div></section>`;
    else if (left === 0) hero = `<section class="hero win"><div class="hero-l"><div class="hero-kicker">All caught up</div><div class="hero-num">${ic('check', 34)} ${totalTarget}<small>pages</small></div><div class="hero-sub">Every target met today${st ? ` · ${plural(st, 'day')} streak` : ''}.</div></div></section>`;
    else hero = `<section class="hero"><div class="hero-l">
        <div class="hero-kicker">Pages to read today</div>
        <div class="hero-num">${left}<small>pages</small></div>
        <div class="hero-sub">${list.length > 1 ? `across ${plural(infos.filter(i => i.remaining > 0).length, 'book')}` : 'for this book'}${mins ? ` · ≈ ${fmtMin(mins)}` : ''}${doneToday ? ` · ${doneToday} of ${totalTarget} done` : ''}</div>
        <div class="hero-bar"><i style="width:${totalTarget ? Math.round(100 * doneToday / totalTarget) : 0}%"></i></div>
      </div></section>`;
    const banner = sim.atRisk.length ? `<button class="banner" data-act="tab" data-tab="plan">${ic('alert', 22)}<span><b>${esc(clip(sim.atRisk[0].b.title))}${sim.atRisk.length > 1 ? ` + ${sim.atRisk.length - 1} more` : ''}</b> ${sim.atRisk.length > 1 ? 'are' : 'is'} at risk. At ~${sim.P} pages/day you'd be ${nf(sim.atRisk.reduce((a, r) => a + r.short, 0))} pages short. <u>See triage</u></span></button>` : '';
    return `
      <header class="hd">
        <div><div class="eyebrow">${DAYL[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}</div><h1>Today</h1></div>
        <div class="streak ${st ? 'on' : ''}" title="Daily target streak">${ic('flame', 18)}<b>${st}</b><span>day${st === 1 ? '' : 's'}</span></div>
      </header>
      ${hero}
      ${banner}
      ${list.length ? `<div class="sec-h"><h2>Reading to a deadline</h2><span>${plural(list.length, 'book')}</span></div>${list.map(b => bookCard(b, t, pc)).join('')}`
        : `<div class="empty">
            <div class="empty-art">${ic('book', 44)}</div>
            <h3>No deadlines yet</h3>
            <p>Add a library loan, book-club pick or class reading. Readline works out how many pages you need each day — and recalculates as you go.</p>
            <button class="btn primary" data-act="add">${ic('plus', 18)} Add a book</button>
          </div>`}
      <div class="spacer"></div>`;
  }

  // ---------- Plan / Triage ----------
  let tio = { pages: '', due: '' , result: null };
  function takeOnVerdict(pages, due, t, pc) {
    const list = active();
    const hypo = { id: '__new', title: 'This book', startPage: 1, endPage: pages, currentPage: 0, deadline: due, readingDays: null, bufferDays: null, checkpoints: [], createdAt: t };
    const before = C.simulate(list, t, pc);
    const after = C.simulate(list.concat(hypo), t, pc);
    const rd = C.countRD(hypo, t, C.effEnd(hypo, t));
    const perDay = Math.ceil(pages / Math.max(1, rd));
    const beforeIds = new Set(before.atRisk.map(r => r.b.id));
    const newRisk = after.atRisk.filter(r => !beforeIds.has(r.b.id));
    if (!newRisk.length) {
      const slack = before.fits ? 'and everything else still fits' : 'though your current load already has a book at risk';
      return { ok: true, perDay, text: `Fits: about <b>${perDay} pages/day</b> on top of your current load at ~${after.P} pages/day, ${slack}.` };
    }
    const others = newRisk.filter(r => r.b.id !== '__new').map(r => r.b);
    const selfRisk = newRisk.find(r => r.b.id === '__new');
    let conflict;
    if (others.length) conflict = `it would push <b>${others.map(b => esc(clip(b.title))).join('</b> and <b>')}</b> past ${others.length > 1 ? 'their deadlines' : 'its deadline'}`;
    else {
      const open = list.filter(b => b.endPage > b.currentPage).sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
      const earlier = open.filter(b => C.effEnd(b, t) <= C.effEnd(hypo, t));
      const comp = (earlier.length ? earlier : open).slice(0, 2);
      conflict = comp.length ? `it clashes with <b>${comp.map(b => esc(clip(b.title))).join('</b> and <b>')}</b> (due ${comp.map(b => fmtD(b.deadline)).join(', ')})` : `it needs ${perDay} pages/day by itself`;
    }
    const short = (selfRisk ? selfRisk.short : 0) + others.reduce((a, b) => a + (after.atRisk.find(r => r.b.id === b.id) || { short: 0 }).short, 0);
    return { ok: false, perDay, text: `Won't fit: needs <b>${perDay} pages/day</b> and ${conflict}. At ~${after.P} pages/day you'd end up about <b>${nf(short)} pages short</b>.` };
  }

  function vPlan() {
    const t = today(), pc = C.pace(t), list = sortActive(active(), t);
    const sim = C.simulate(list, t, pc);
    const overdue = list.filter(b => b.deadline < t);
    // verdict
    const needToday = list.reduce((a, b) => a + C.info(b, t, pc).target, 0);
    let verdict;
    if (!list.length) verdict = `<div class="verdict calm">${ic('book', 24)}<div><b>Nothing to plan yet</b><p>Add a deadline book and your 14-day plan appears here.</p></div></div>`;
    else if (sim.fits) verdict = `<div class="verdict good">${ic('check', 24)}<div><b>Everything fits</b><p>At your pace of ~${sim.P} pages/day${sim.assumed ? ' (assumed until you log a few sessions)' : ''}, all ${plural(list.length, 'book')} finish before their deadlines.</p></div></div>`;
    else verdict = `<div class="verdict bad">${ic('alert', 24)}<div><b>${plural(sim.atRisk.length, 'book')} at risk</b><p>At ~${sim.P} pages/day${sim.assumed ? ' (assumed)' : ''} you won't finish ${sim.atRisk.map(r => `<b>${esc(clip(r.b.title))}</b> (${nf(r.short)} pages short)`).join(', ')} in time.</p></div></div>`;

    // suggestions
    const sug = [];
    if (sim.order.length > 1) {
      const f = sim.order[0];
      sug.push(`<div class="sug"><div class="sug-ic" style="--bc:${esc(f.color)}">1</div><div class="sug-t"><b>Read ${esc(clip(f.title))} first</b><span>Its deadline is soonest (${fmtD(C.effEnd(f, t))}${C.bufferOf(f) ? ', with buffer' : ''}).</span></div></div>`);
    }
    for (const r of sim.atRisk) {
      const b = r.b, isLib = b.type === 'library';
      const L = S.settings.loanLengthDays;
      sug.push(`<div class="sug"><div class="sug-ic warn">${ic('renew', 18)}</div><div class="sug-t"><b>${isLib ? 'Renew' : 'Push back'} ${esc(clip(b.title))}</b><span>Gains time for ${nf(r.short)} pages. Due ${fmtD(b.deadline)}.</span>
        <div class="sug-a"><button class="btn soft sm" data-act="renew" data-id="${b.id}" data-days="${L}">+${L} days</button>${L !== 21 ? `<button class="btn soft sm" data-act="renew" data-id="${b.id}" data-days="21">+21 days</button>` : `<button class="btn soft sm" data-act="renew" data-id="${b.id}" data-days="7">+7 days</button>`}</div></div></div>`);
      const prog = (b.currentPage - b.startPage + 1) / (b.endPage - b.startPage + 1);
      if (prog < 0.25) {
        sug.push(`<div class="sug"><div class="sug-ic">${ic('undo', 18)}</div><div class="sug-t"><b>${isLib ? 'Return' : 'Set aside'} ${esc(clip(b.title))} unread</b><span>Frees ${nf(b.endPage - b.currentPage)} pages from your plan. ${isLib ? 'You can borrow it again later.' : ''}</span>
          <div class="sug-a"><button class="btn ghost sm" data-act="status" data-id="${b.id}" data-st="${isLib ? 'returned' : 'abandoned'}">${isLib ? 'Return unread' : 'Set aside'}</button></div></div></div>`);
      }
    }

    // calendar rows: 3 past days + today + 10
    const plans = {}; list.forEach(b => { plans[b.id] = C.planBook(b, t, 11); });
    const rows = [];
    let maxTotal = 1;
    const dayData = [];
    for (let k = -3; k <= 10; k++) {
      const day = addDays(t, k);
      const segs = [];
      if (k < 0) {
        const per = {};
        S.sessions.forEach(s => { if (s.date === day) per[s.bookId] = (per[s.bookId] || 0) + Math.max(0, s.toPage - s.fromPage); });
        Object.keys(per).forEach(id => { const b = byId(id); if (b && per[id] > 0) segs.push({ c: b.color, n: per[id], title: b.title }); });
      } else {
        list.forEach(b => { const p = plans[b.id][k]; if (p && p.planned > 0) segs.push({ c: b.color, n: p.planned, title: b.title }); });
      }
      const total = segs.reduce((a, s) => a + s.n, 0);
      maxTotal = Math.max(maxTotal, total);
      const flags = [];
      S.books.forEach(b => {
        if ((b.status === 'active' || k < 0) && b.deadline === day) flags.push(`<span class="flag" style="--bc:${esc(b.color)}">${ic('flag', 12)} ${esc(short(b.title))} due</span>`);
        if (b.status === 'active') (b.checkpoints || []).forEach(c => { if (c.date === day) flags.push(`<span class="flag cp" style="--bc:${esc(b.color)}">${ic('flag', 12)} p. ${c.page} · ${esc(short(c.label || b.title))}</span>`); });
      });
      dayData.push({ day, k, segs, total, flags, hit: S.streak.hitDates.includes(day) });
    }
    for (const r of dayData) {
      const d = parse(r.day);
      rows.push(`<div class="drow ${r.k === 0 ? 'today' : ''} ${r.k < 0 ? 'past' : ''}">
        <div class="dl"><b>${r.k === 0 ? 'Today' : DAY[d.getDay()]}</b><span>${d.getDate()} ${MON[d.getMonth()]}</span></div>
        <div class="dmid">
          <div class="dbar"><div class="dfill" style="width:${Math.max(r.total ? 6 : 0, Math.round(100 * r.total / maxTotal))}%">${r.segs.map(s => `<i style="flex:${s.n};background:${esc(s.c)}" title="${esc(s.title)}"></i>`).join('')}</div></div>
          ${r.flags.length ? `<div class="flags">${r.flags.join('')}</div>` : ''}
        </div>
        <div class="dn">${r.total ? r.total : '<span class="zero">0</span>'}${r.hit ? `<span class="hit">${ic('check', 14)}</span>` : (r.k < 0 && r.total ? '' : '')}</div>
      </div>`);
    }
    const legend = list.map(b => `<span class="lg"><i style="background:${esc(b.color)}"></i>${esc(short(b.title))}</span>`).join('');
    const tr = tio.result;
    return `
      <header class="hd"><div><div class="eyebrow">Triage &amp; 14-day plan</div><h1>Plan</h1></div></header>
      ${overdue.length ? `<div class="banner static">${ic('alert', 22)}<span><b>Overdue:</b> ${overdue.map(b => `${esc(b.title)} (due ${fmtD(b.deadline)})`).join(', ')}. Renew or return to avoid fines.</span></div>` : ''}
      ${verdict}
      ${list.length ? `<div class="statline"><div><b>${needToday}</b><span>pages due today</span></div><div><b>${pc.avgDay ? Math.round(pc.avgDay) : '—'}</b><span>avg pages/day</span></div><div><b>${pc.ppm ? pc.ppm.toFixed(1) : '—'}</b><span>pages/min</span></div></div>` : ''}
      ${sug.length ? `<div class="sec-h"><h2>Suggestions</h2></div><div class="card pad">${sug.join('')}</div>` : ''}
      ${list.length ? `<div class="sec-h"><h2>Pages per day</h2><span>last 3 days · next 10</span></div>
        <div class="legend">${legend}</div>
        <div class="card cal">${rows.join('')}</div>` : ''}
      <div class="sec-h"><h2>Can I take this on?</h2></div>
      <div class="card pad takeon">
        <p class="muted">Before you borrow or accept a new book, check it against everything you're already reading.</p>
        <div class="row2">
          <label class="fld"><span>Pages</span><input id="tioPages" type="number" inputmode="numeric" min="1" placeholder="e.g. 350" value="${esc(tio.pages)}"></label>
          <label class="fld"><span>Due date</span><input id="tioDue" type="date" min="${addDays(t, 1)}" value="${esc(tio.due || addDays(t, S.settings.loanLengthDays))}"></label>
        </div>
        <button class="btn primary block" data-act="takeon">${ic('scale', 18)} Check my load</button>
        ${tr ? `<div class="verdict ${tr.ok ? 'good' : 'bad'} mt">${ic(tr.ok ? 'check' : 'alert', 22)}<div><p>${tr.text}</p></div></div>` : ''}
      </div>
      <div class="spacer"></div>`;
  }
  const short = s => (s.length > 22 ? s.slice(0, 20).trim() + '…' : s);
  function clip(s) { return s.length > 48 ? s.slice(0, 46).trim() + '…' : s; }

  // ---------- Shelf ----------
  function vShelf() {
    const t = today();
    const done = S.books.filter(b => b.status !== 'active').sort((a, b) => ((b.finishedAt || '') > (a.finishedAt || '') ? 1 : -1));
    const fin = S.books.filter(b => b.status === 'finished');
    const ot = fin.filter(onTime).length;
    const month = t.slice(0, 7);
    const pagesMonth = S.sessions.filter(s => s.date.slice(0, 7) === month).reduce((a, s) => a + Math.max(0, s.toPage - s.fromPage), 0);
    const days = new Set(S.sessions.map(s => s.date));
    const allPages = S.sessions.reduce((a, s) => a + Math.max(0, s.toPage - s.fromPage), 0);
    const avg = days.size ? Math.round(allPages / days.size) : 0;
    const items = done.map(b => {
      let badge;
      if (b.status === 'finished') {
        const dd = b.finishedAt ? diff(b.finishedAt, b.deadline) : 0;
        badge = onTime(b) ? `<span class="badge ok">${ic('check', 13)} On time${dd > 0 ? ` · ${dd}d early` : ''}</span>` : `<span class="badge bad">Late · ${-dd}d</span>`;
      } else if (b.status === 'returned') badge = '<span class="badge">Returned unread</span>';
      else badge = '<span class="badge">Abandoned</span>';
      const span = b.finishedAt ? Math.max(1, diff(b.createdAt, b.finishedAt)) : 1;
      const read = b.currentPage - b.startPage + 1;
      return `<button class="shelf-item" data-act="detail" data-id="${b.id}" style="--bc:${esc(b.color)}">
        <span class="sp"></span>
        <span class="si-b"><b>${esc(b.title)}</b><small>${esc(b.author || TYPES[b.type].label)}</small>
        <span class="si-m">${badge}<span class="mono">${b.finishedAt ? fmtD(b.finishedAt) : ''}${b.status === 'finished' ? ` · ${Math.round(read / span)} p/day` : ` · ${Math.max(0, read)} of ${b.endPage - b.startPage + 1} p.`}</span></span></span>
      </button>`;
    }).join('');
    return `
      <header class="hd"><div><div class="eyebrow">History &amp; stats</div><h1>Shelf</h1></div>
        <button class="icon-btn" data-act="shareSummary" aria-label="Share summary">${ic('share', 22)}</button></header>
      <div class="stats">
        <div class="stat"><b>${fin.length}</b><span>books finished</span></div>
        <div class="stat"><b>${fin.length ? Math.round(100 * ot / fin.length) + '%' : '—'}</b><span>finished on time</span></div>
        <div class="stat"><b>${nf(pagesMonth)}</b><span>pages in ${MON[parse(t).getMonth()]}</span></div>
        <div class="stat"><b>${avg || '—'}</b><span>avg pages / reading day</span></div>
      </div>
      <button class="btn soft block" data-act="shareSummary">${ic('share', 18)} Share reading summary</button>
      <div class="sec-h"><h2>Past books</h2><span>${plural(done.length, 'book')}</span></div>
      ${done.length ? `<div class="card list">${items}</div>` : `<div class="empty small"><div class="empty-art">${ic('book', 36)}</div><h3>Your shelf is empty</h3><p>Books you finish, return or set aside land here with their on-time record.</p></div>`}
      <div class="spacer"></div>`;
  }
  function summaryText() {
    const t = today(), fin = S.books.filter(b => b.status === 'finished'), ot = fin.filter(onTime).length;
    const month = t.slice(0, 7);
    const pm = S.sessions.filter(s => s.date.slice(0, 7) === month).reduce((a, s) => a + Math.max(0, s.toPage - s.fromPage), 0);
    const lines = ['My reading — Readline', ''];
    lines.push(`Finished ${plural(fin.length, 'book')}${fin.length ? ` (${Math.round(100 * ot / fin.length)}% on time)` : ''}`);
    lines.push(`${nf(pm)} pages read in ${MON[parse(t).getMonth()]}`);
    const st = streakNow(); if (st) lines.push(`${plural(st, 'day')} target streak`);
    const act = active();
    if (act.length) { lines.push('', 'Reading now:'); act.forEach(b => { const i = C.info(b, t); lines.push(`• ${b.title} — ${i.pct}%, due ${fmtD(b.deadline)}`); }); }
    const rec = fin.slice().sort((a, b) => ((b.finishedAt || '') > (a.finishedAt || '') ? 1 : -1)).slice(0, 3);
    if (rec.length) { lines.push('', 'Recently finished:'); rec.forEach(b => lines.push(`• ${b.title}${b.author ? ' by ' + b.author : ''}${onTime(b) ? ' ✓ on time' : ''}`)); }
    return lines.join('\n');
  }

  // ---------- Settings ----------
  let importText = '';
  function vSettings() {
    const st = S.settings;
    const json = JSON.stringify(S, null, 1);
    return `
      <header class="hd"><div><div class="eyebrow">Defaults &amp; data</div><h1>Settings</h1></div></header>
      <div class="sec-h"><h2>Reading defaults</h2></div>
      <div class="card pad">
        <div class="set-l">Reading days<small>Books without their own schedule plan pages only on these days.</small></div>
        <div class="days">${DAY.map((d, i) => `<button class="day ${st.readingDays[i] ? 'on' : ''}" data-act="setDay" data-i="${i}" aria-pressed="${st.readingDays[i]}">${d[0]}</button>`).join('')}</div>
        <div class="set-row"><div class="set-l">Buffer days<small>Aim to finish this many days early.</small></div>
          <div class="stepper"><button data-act="setNum" data-k="bufferDays" data-d="-1" aria-label="Less">−</button><b>${st.bufferDays}</b><button data-act="setNum" data-k="bufferDays" data-d="1" aria-label="More">+</button></div></div>
        <div class="set-row"><div class="set-l">Loan length<small>Default renewal length and due date.</small></div>
          <div class="stepper"><button data-act="setNum" data-k="loanLengthDays" data-d="-7" aria-label="Shorter">−</button><b>${st.loanLengthDays}d</b><button data-act="setNum" data-k="loanLengthDays" data-d="7" aria-label="Longer">+</button></div></div>
      </div>
      <div class="sec-h"><h2>Appearance</h2></div>
      <div class="card pad"><div class="seg">${['system', 'light', 'dark'].map(k => `<button class="${st.theme === k ? 'on' : ''}" data-act="theme" data-v="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></div>
      <div class="sec-h"><h2>Backup</h2></div>
      <div class="card pad">
        <div class="set-l">Export<small>Everything — books, sessions, renewals, settings — as JSON.</small></div>
        <textarea class="code" readonly rows="4" id="exportBox">${esc(json)}</textarea>
        <div class="btn-row"><button class="btn soft" data-act="copyExport">${ic('copy', 18)} Copy</button><button class="btn soft" data-act="shareExport">${ic('share', 18)} Share</button></div>
        <div class="set-l mt">Import<small>Paste a Readline backup. This replaces your current data.</small></div>
        <textarea class="code" rows="4" id="importBox" placeholder='{"settings": …, "books": […]}'>${esc(importText)}</textarea>
        <div id="importErr" class="err"></div>
        <button class="btn primary block" data-act="import">Import backup</button>
      </div>
      <div class="sec-h"><h2>Data</h2></div>
      <div class="card pad">
        <div class="btn-row"><button class="btn ghost" data-act="sample">Load sample books</button><button class="btn danger" data-act="reset">${ic('trash', 18)} Reset all</button></div>
        <p class="muted small mt">Readline is private: no account, no ads, no network. Your data never leaves this phone unless you export it.</p>
      </div>
      <p class="foot">Readline · reading to a deadline</p>
      <div class="spacer"></div>`;
  }

  // ---------- Book detail ----------
  function ring(pct, color) {
    const r = 46, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
    return `<svg viewBox="0 0 110 110" class="ring"><circle cx="55" cy="55" r="${r}" class="ring-bg"/><circle cx="55" cy="55" r="${r}" stroke="${esc(color)}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" class="ring-fg"/></svg>`;
  }
  function sparkline(b, t) {
    const n = 14, vals = [];
    for (let k = n - 1; k >= 0; k--) {
      const day = addDays(t, -k);
      vals.push({ day, v: S.sessions.filter(s => s.bookId === b.id && s.date === day).reduce((a, s) => a + Math.max(0, s.toPage - s.fromPage), 0) });
    }
    const max = Math.max(10, ...vals.map(x => x.v));
    const w = 300, h = 64, bw = 15, gap = (w - n * bw) / (n - 1);
    const bars = vals.map((x, i) => {
      const bh = x.v ? Math.max(3, Math.round((h - 14) * x.v / max)) : 2;
      return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${h - 12 - bh}" width="${bw}" height="${bh}" rx="3" fill="${x.v ? esc(b.color) : 'var(--line)'}" opacity="${x.day === t ? 1 : 0.85}"/>${x.v ? `<text x="${(i * (bw + gap) + bw / 2).toFixed(1)}" y="${h - 15 - bh}" text-anchor="middle">${x.v}</text>` : ''}`;
    }).join('');
    const total = vals.reduce((a, x) => a + x.v, 0), dd = vals.filter(x => x.v).length;
    return `<svg viewBox="0 -8 ${w} ${h + 8}" class="spark" preserveAspectRatio="none">${bars}
      <text x="0" y="${h}" class="ax">${fmtD(vals[0].day)}</text><text x="${w}" y="${h}" text-anchor="end" class="ax">Today</text></svg>
      <div class="muted small">${dd ? `${total} pages over ${plural(dd, 'reading day')} · ${Math.round(total / dd)} pages/day` : 'No sessions in the last two weeks.'}</div>`;
  }

  function vDetail(id) {
    const b = byId(id);
    if (!b) return '<div class="pg-hd"><button class="icon-btn" data-act="close">' + ic('back', 24) + '</button></div><div class="empty"><h3>Book removed</h3></div>';
    const t = today(), pc = C.pace(t), i = C.info(b, t, pc), isActive = b.status === 'active';
    const ses = S.sessions.filter(s => s.bookId === b.id).sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : (y.at || 0) - (x.at || 0)));
    const lastId = C.latestSessionId(b.id);
    const timerOn = S.timer && S.timer.bookId === b.id;
    const otherTimer = S.timer && S.timer.bookId !== b.id;
    const cps = (b.checkpoints || []).slice().sort((x, y) => (x.date < y.date ? -1 : 1));
    const L = S.settings.loanLengthDays;
    const dleft = i.daysLeft;
    let statusBox = '';
    if (!isActive) {
      const lbl = b.status === 'finished' ? (onTime(b) ? `Finished on time · ${fmtD(b.finishedAt)}` : `Finished late · ${fmtD(b.finishedAt)}`) : b.status === 'returned' ? `Returned unread · ${b.finishedAt ? fmtD(b.finishedAt) : ''}` : `Set aside · ${b.finishedAt ? fmtD(b.finishedAt) : ''}`;
      statusBox = `<div class="verdict ${b.status === 'finished' && onTime(b) ? 'good' : 'calm'}">${ic(b.status === 'finished' ? 'check' : 'book', 22)}<div><b>${lbl}</b><p>Deadline was ${fmtD(b.deadline)}.</p></div></div>`;
    }
    return `
      <div class="pg-hd">
        <button class="icon-btn" data-act="close" aria-label="Back">${ic('back', 24)}</button>
        <span class="pg-t">${TYPES[b.type].label}</span>
        <button class="icon-btn" data-act="edit" data-id="${b.id}" aria-label="Edit">${ic('edit', 21)}</button>
      </div>
      <div class="pg-body" style="--bc:${esc(b.color)}">
        <div class="dt-hero">
          <div class="ring-w">${ring(i.pct, b.color)}<div class="ring-c"><b>${i.pct}%</b><span>p. ${b.currentPage}/${b.endPage}</span></div></div>
          <div class="dt-info">
            <h2 class="dt-title">${esc(b.title)}</h2>
            ${b.author ? `<div class="bk-author">${esc(b.author)}</div>` : ''}
            <div class="stamp big ${dleft < 0 && isActive ? 'late' : dleft <= 2 && isActive ? 'soon' : ''}">DUE ${stamp(b.deadline)}</div>
            ${isActive ? `<div class="count">${dleft >= 0 ? `<b>${dleft}</b> day${dleft === 1 ? '' : 's'} left` : `<b>${-dleft}</b> days overdue`}${C.bufferOf(b) ? ` · aim ${fmtD(i.end)}` : ''}</div>` : ''}
          </div>
        </div>
        ${statusBox}
        ${isActive ? `
          <div class="card pad">${targetBlock(b, i, true)}
            <div class="chips"><span class="chip ${chipCls(i.status.key)}">${i.status.label}</span>${!pc.ppm ? '<span class="chip">Time a session for estimates</span>' : ''}</div></div>
          <div class="card pad timer ${timerOn ? 'run' : ''}">
            <div><div class="lbl">Session timer</div><div class="tm" ${timerOn ? 'data-timer' : ''}>${timerOn ? '0:00' : '0:00'}</div>
              <div class="muted small">${pc.ppm ? `Your pace: ${pc.ppm.toFixed(2)} pages/min` : 'Times sessions to learn your reading speed.'}</div></div>
            ${timerOn ? `<button class="btn primary round" data-act="timerStop" data-id="${b.id}" aria-label="Stop and log">${ic('stop', 22)}</button>`
              : `<button class="btn soft round" data-act="timerStart" data-id="${b.id}" aria-label="Start timer" ${otherTimer ? 'disabled' : ''}>${ic('play', 22)}</button>`}
          </div>` : ''}
        ${cps.length ? `<div class="sec-h"><h2>Checkpoints</h2></div><div class="card list">${cps.map(c => `<div class="li"><span class="li-ic ${b.currentPage >= c.page ? 'ok' : c.date < t ? 'bad' : ''}">${ic(b.currentPage >= c.page ? 'check' : 'flag', 16)}</span><span class="li-b"><b>p. ${c.page}${c.label ? ' · ' + esc(c.label) : ''}</b><small>${fmtD(c.date)} · ${rel(diff(t, c.date))}</small></span></div>`).join('')}</div>` : ''}
        <div class="sec-h"><h2>Pace</h2><span>pages per day</span></div>
        <div class="card pad">${sparkline(b, t)}</div>
        ${isActive ? `<div class="sec-h"><h2>Renew / extend</h2></div>
          <div class="card pad"><div class="btn-row"><button class="btn soft" data-act="renew" data-id="${b.id}" data-days="${L}">${ic('renew', 18)} +${L} days</button><button class="btn soft" data-act="renew" data-id="${b.id}" data-days="${L === 21 ? 7 : 21}">+${L === 21 ? 7 : 21} days</button></div>
          ${b.renewals.length ? `<div class="renews">${b.renewals.map(r => `<div class="li"><span class="li-ic">${ic('renew', 15)}</span><span class="li-b"><b>Renewed ${fmtD(r.date)}</b><small class="mono">${stamp(r.oldDeadline)} → ${stamp(r.newDeadline)}</small></span></div>`).join('')}</div>` : '<p class="muted small mt">Renewals are logged here.</p>'}</div>`
          : (b.renewals.length ? `<div class="sec-h"><h2>Renewals</h2></div><div class="card list">${b.renewals.map(r => `<div class="li"><span class="li-ic">${ic('renew', 15)}</span><span class="li-b"><b>Renewed ${fmtD(r.date)}</b><small class="mono">${stamp(r.oldDeadline)} → ${stamp(r.newDeadline)}</small></span></div>`).join('')}</div>` : '')}
        <div class="sec-h"><h2>Sessions</h2><span>${plural(ses.length, 'session')}</span></div>
        ${ses.length ? `<div class="card list">${ses.slice(0, 40).map(s => `<div class="li"><span class="li-ic">${ic('book', 15)}</span><span class="li-b"><b>p. ${s.fromPage} → ${s.toPage} <em>+${s.toPage - s.fromPage}</em></b><small>${fmtD(s.date)}${s.minutes ? ` · ${Math.round(s.minutes)} min` : ''}</small></span>${s.id === lastId && isActive ? `<button class="icon-btn sm" data-act="undoSession" data-id="${s.id}" aria-label="Undo">${ic('undo', 18)}</button>` : ''}</div>`).join('')}</div>`
          : '<div class="card pad"><p class="muted small">No sessions yet — tap Log after you read.</p></div>'}
        <div class="sec-h"><h2>${isActive ? 'Wrap up' : 'Manage'}</h2></div>
        <div class="card pad acts">
          ${isActive ? `<button class="btn primary block" data-act="finish" data-id="${b.id}">${ic('check', 18)} Mark finished</button>
            <div class="btn-row"><button class="btn ghost" data-act="status" data-id="${b.id}" data-st="returned">Returned unread</button><button class="btn ghost" data-act="status" data-id="${b.id}" data-st="abandoned">Abandon</button></div>`
            : `<button class="btn soft block" data-act="reopen" data-id="${b.id}">${ic('undo', 18)} Back to reading</button>`}
          <button class="btn danger-ghost block" data-act="delete" data-id="${b.id}">${ic('trash', 18)} Delete book</button>
        </div>
        <div class="spacer sm"></div>
      </div>`;
  }
  function openDetail(id) { pushLayer('page', () => vDetail(id), { type: 'detail', id }); }

  // ---------- Log sheet ----------
  function openLog(id, minutes) {
    const b = byId(id); if (!b) return;
    const t = today(), i = C.info(b, t);
    const suggested = Math.min(b.endPage, Math.max(b.currentPage + 1, i.readTo));
    const L = pushLayer('sheet', () => `
      <div class="grab"></div>
      <h3 class="sh-t">Log progress</h3>
      <p class="muted">${esc(b.title)} · last at p. ${b.currentPage}${i.remaining ? ` · target p. ${i.readTo}` : ''}</p>
      <label class="fld"><span>I stopped at page</span>
        <input id="logPage" class="pagein" type="number" inputmode="numeric" min="${b.currentPage + 1}" max="${b.endPage}" placeholder="${suggested}" value=""></label>
      <div class="quick">
        <button class="chipbtn" data-q="10">+10</button><button class="chipbtn" data-q="25">+25</button>
        ${i.remaining ? `<button class="chipbtn" data-q="target">Target p. ${i.readTo}</button>` : ''}
        <button class="chipbtn" data-q="end">The end</button>
      </div>
      <label class="fld"><span>Minutes read <em>(optional)</em></span>
        <input id="logMin" type="number" inputmode="numeric" min="1" placeholder="e.g. 30" value="${minutes ? minutes : ''}"></label>
      <div id="logErr" class="err"></div>
      <button class="btn primary block lg" id="logSave">${ic('check', 20)} Save session</button>`, { static: true });
    const inp = $('#logPage', L.panel);
    L.panel.addEventListener('click', e => {
      const q = e.target.closest('[data-q]');
      if (q) {
        const base = int(inp.value, b.currentPage);
        const v = q.dataset.q === 'end' ? b.endPage : q.dataset.q === 'target' ? i.readTo : Math.min(b.endPage, base + int(q.dataset.q, 0));
        inp.value = v; $('#logErr', L.panel).textContent = ''; return;
      }
      if (e.target.closest('#logSave')) {
        if (L.done) return;
        const v = int(inp.value, NaN);
        const err = $('#logErr', L.panel);
        if (isNaN(v)) { err.textContent = 'Enter the page you stopped at.'; inp.focus(); return; }
        if (v <= b.currentPage) { err.textContent = `You were already on p. ${b.currentPage}. Enter a later page.`; return; }
        if (v > b.endPage) { err.textContent = `This book ends at p. ${b.endPage}.`; return; }
        const m = $('#logMin', L.panel).value;
        L.done = true;
        logSession(b, v, m === '' ? null : Math.max(1, Number(m) || 0) || null);
        closeTop();
      }
    });
    setTimeout(() => { try { inp.focus(); } catch (e) { /* ignore */ } }, 300);
  }
  function logSession(b, page, minutes) {
    const t = today();
    const pages = page - b.currentPage;
    S.sessions.push({ id: uid('s'), bookId: b.id, date: t, fromPage: b.currentPage, toPage: page, minutes, at: Date.now() });
    b.currentPage = page;
    const hit = checkHit();
    persist(); render();
    vibrate(20);
    if (hit) { vibrate(60); toast(`Daily target hit · ${plural(S.streak.current, 'day')} streak`); }
    else toast(`Logged ${plural(pages, 'page')}${minutes ? ` in ${minutes} min` : ''}`);
    if (b.currentPage >= b.endPage) setTimeout(() => promptFinish(b), 350);
  }
  function promptFinish(b) {
    dialog({ icon: 'check', tone: 'ok', title: 'You reached the last page!', body: `<p>Mark <b>${esc(b.title)}</b> as finished and move it to your shelf?</p>`,
      actions: [{ label: 'Not yet' }, { label: 'Mark finished', kind: 'primary', fn: () => finishBook(b) }] });
  }
  function finishBook(b) {
    const t = today();
    b.status = 'finished'; b.finishedAt = t;
    if (S.timer && S.timer.bookId === b.id) S.timer = null;
    const dd = diff(t, b.deadline);
    checkHit();
    persist();
    while (layers.length && layers[layers.length - 1].kind !== 'page') closeTop();
    if (layers.length && layers[layers.length - 1].id === b.id) closeTop();
    render();
    vibrate(250);
    toast(dd > 0 ? `Finished “${short(b.title)}” — ${plural(dd, 'day')} early!` : dd === 0 ? `Finished “${short(b.title)}” — right on the due date!` : `Finished “${short(b.title)}”`);
  }

  // ---------- Add / Edit ----------
  function openEdit(id) {
    const t = today(), ex = id ? byId(id) : null;
    const st = S.settings;
    const d = ex ? {
      title: ex.title, author: ex.author, type: ex.type, startPage: ex.startPage, endPage: ex.endPage, currentPage: ex.currentPage,
      deadline: ex.deadline, readingDays: (ex.readingDays || st.readingDays).slice(), bufferDays: C.bufferOf(ex), color: ex.color,
      checkpoints: (ex.checkpoints || []).map(c => Object.assign({}, c))
    } : {
      title: '', author: '', type: 'library', startPage: 1, endPage: '', currentPage: 0, deadline: addDays(t, st.loanLengthDays),
      readingDays: st.readingDays.slice(), bufferDays: st.bufferDays, color: COLORS[active().length % COLORS.length], checkpoints: []
    };
    let tried = false;
    const touched = new Set();
    const cpRows = () => d.checkpoints.map((c, k) => `
      <div class="cp-row">
        <label class="fld"><span>Page</span><input type="number" inputmode="numeric" data-cp="${k}" data-f="page" value="${esc(c.page)}"></label>
        <label class="fld"><span>By</span><input type="date" data-cp="${k}" data-f="date" value="${esc(c.date)}"></label>
        <button class="icon-btn sm" data-cprm="${k}" aria-label="Remove checkpoint">${ic('x', 18)}</button>
        <label class="fld wide"><span>Label</span><input type="text" data-cp="${k}" data-f="label" placeholder="e.g. Meeting: chapters 1–12" value="${esc(c.label)}"></label>
      </div>`).join('');
    const L = pushLayer('page', () => `
      <div class="pg-hd">
        <button class="icon-btn" data-act="close" aria-label="Cancel">${ic('x', 24)}</button>
        <span class="pg-t">${ex ? 'Edit book' : 'New deadline book'}</span>
        <span style="width:44px"></span>
      </div>
      <form class="pg-body form" id="bookForm" novalidate autocomplete="off">
        <label class="fld"><span>Title</span><input name="title" type="text" maxlength="160" placeholder="e.g. The Remains of the Day" value="${esc(d.title)}"><em class="err" data-err="title"></em></label>
        <label class="fld"><span>Author <em>(optional)</em></span><input name="author" type="text" placeholder="Author" value="${esc(d.author)}"></label>
        <div class="fld"><span>Type</span><div class="seg four">${Object.keys(TYPES).map(k => `<button type="button" data-type="${k}" class="${d.type === k ? 'on' : ''}">${TYPES[k].short}</button>`).join('')}</div></div>
        <div class="row3">
          <label class="fld"><span>From p.</span><input name="startPage" type="number" inputmode="numeric" min="1" value="${esc(d.startPage)}"></label>
          <label class="fld"><span>To p.</span><input name="endPage" type="number" inputmode="numeric" min="1" placeholder="300" value="${esc(d.endPage)}"></label>
          <label class="fld"><span>I'm on p.</span><input name="currentPage" type="number" inputmode="numeric" min="0" value="${esc(d.currentPage)}"></label>
        </div>
        <em class="err" data-err="pages"></em>
        <label class="fld"><span>${d.type === 'library' ? 'Due date' : 'Deadline'}</span><input name="deadline" type="date" value="${esc(d.deadline)}"><em class="err" data-err="deadline"></em></label>
        <div class="fld"><span>Reading days</span><div class="days">${DAY.map((x, k) => `<button type="button" class="day ${d.readingDays[k] ? 'on' : ''}" data-rday="${k}">${x[0]}</button>`).join('')}</div>
          <div class="quick tight"><button type="button" class="chipbtn" data-preset="all">Every day</button><button type="button" class="chipbtn" data-preset="wk">Weekdays</button><button type="button" class="chipbtn" data-preset="we">Weekends</button></div>
          <em class="err" data-err="days"></em></div>
        <div class="set-row"><div class="set-l">Buffer days<small>Finish this many days before the deadline.</small></div>
          <div class="stepper"><button type="button" data-buf="-1" aria-label="Less">−</button><b id="bufV">${d.bufferDays}</b><button type="button" data-buf="1" aria-label="More">+</button></div></div>
        <div class="fld"><span>Color</span><div class="swatches">${COLORS.map(c => `<button type="button" class="sw ${d.color === c ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div></div>
        <div class="fld"><span>Checkpoints <em>${d.type === 'club' ? '(meeting sections)' : '(optional)'}</em></span>
          <div id="cps">${cpRows()}</div>
          <button type="button" class="btn ghost sm" id="addCp">${ic('flag', 16)} Add checkpoint</button>
          <em class="err" data-err="cps"></em></div>
        <div class="preview" id="preview"></div>
        <div class="spacer sm"></div>
      </form>
      <div class="sticky-save"><button class="btn primary block lg" id="saveBook">${ic('check', 20)} ${ex ? 'Save changes' : 'Add book'}</button></div>`, { static: true, type: 'edit' });

    const form = $('#bookForm', L.panel);
    const read = () => {
      const f = form.elements;
      d.title = f.title.value; d.author = f.author.value;
      d.startPage = f.startPage.value; d.endPage = f.endPage.value; d.currentPage = f.currentPage.value; d.deadline = f.deadline.value;
    };
    const build = () => {
      const sp = Math.max(1, int(d.startPage, 1)), ep = int(d.endPage, NaN), cp = int(d.currentPage, sp - 1);
      return {
        id: ex ? ex.id : '__draft', title: d.title.trim(), author: d.author.trim(), type: d.type, color: d.color,
        startPage: sp, endPage: ep, currentPage: Math.max(sp - 1, cp), deadline: d.deadline,
        readingDays: d.readingDays.every((v, k) => v === st.readingDays[k]) ? null : d.readingDays.slice(),
        bufferDays: d.bufferDays === st.bufferDays && (!ex || ex.bufferDays == null) ? null : d.bufferDays,
        checkpoints: d.checkpoints.filter(c => c.page !== '' && c.date).map(c => ({ page: int(c.page, 0), date: c.date, label: String(c.label || '').trim() })),
        createdAt: ex ? ex.createdAt : t, planFrom: ex ? ex.planFrom : { date: t, page: Math.max(sp - 1, cp) }
      };
    };
    const validate = () => {
      const e = {};
      const b = build();
      if (!b.title) e.title = 'Give the book a title.';
      if (isNaN(b.endPage)) e.pages = 'Enter the last page you need to read.';
      else if (b.endPage < b.startPage) e.pages = `The last page must be after p. ${b.startPage}.`;
      else if (int(d.currentPage, 0) > b.endPage) e.pages = `Current page can't be past the last page (p. ${b.endPage}).`;
      else if (int(d.currentPage, 0) < 0) e.pages = 'Current page can’t be negative.';
      if (!validDate(b.deadline)) e.deadline = 'Pick a deadline.';
      else if (b.deadline < t && (!ex || ex.deadline !== b.deadline)) e.deadline = 'That date has already passed — pick a future deadline.';
      if (!d.readingDays.some(Boolean)) e.days = 'Pick at least one reading day.';
      for (const c of b.checkpoints) {
        if (!isNaN(b.endPage) && (c.page <= b.startPage - 1 || c.page > b.endPage)) { e.cps = `Checkpoint p. ${c.page} is outside the book's pages.`; break; }
        if (validDate(b.deadline) && c.date > b.deadline) { e.cps = `Checkpoint on ${fmtD(c.date)} is after the deadline.`; break; }
        if (c.date <= t) { e.cps = 'Checkpoint dates should be in the future.'; break; }
      }
      return { e, b };
    };
    const show = () => {
      const { e, b } = validate();
      const vis = k => tried || touched.has(k);
      form.querySelectorAll('[data-err]').forEach(el => {
        const k = el.dataset.err;
        const map = { title: 'title', pages: 'pages', deadline: 'deadline', days: 'days', cps: 'cps' };
        el.textContent = e[k] && vis(map[k]) ? e[k] : '';
      });
      const pv = $('#preview', L.panel);
      const ready = !e.pages && !e.deadline && !e.days && !isNaN(b.endPage);
      if (!ready) { pv.innerHTML = `<div class="pv-empty">${ic('clock', 20)} Fill in pages and a deadline to see your daily target.</div>`; return e; }
      const pc = C.pace(t);
      const i = C.info(b, t, pc);
      const rd = C.countRD(b, t, i.end);
      let html = `<div class="pv-top"><div><div class="lbl">Daily target</div><div class="big">${i.need || 0}<small> pages/day</small></div></div>
        <div class="pv-r">${i.target ? `Read to <b>p. ${i.readTo}</b> today` : i.left ? `${i.restDay ? 'Rest day today' : 'Target met today'}` : 'Nothing left to read'}<br><span class="muted">${plural(rd, 'reading day')} until ${fmtD(i.end)}${pc.ppm && i.need ? ` · ≈ ${fmtMin(Math.max(1, Math.round(i.need / pc.ppm)))}/day` : ''}</span></div></div>`;
      html += `<div class="chips"><span class="chip ${chipCls(i.status.key)}">${i.status.label}</span>${i.seg && i.seg.cp ? `<span class="chip">${ic('flag', 14)} aiming at p. ${i.seg.cp.page} first</span>` : ''}</div>`;
      if (!ex && b.endPage > b.currentPage) {
        const v = takeOnVerdict(b.endPage - b.currentPage, b.deadline, t, pc);
        html += `<div class="pv-v ${v.ok ? 'good' : 'bad'}">${ic(v.ok ? 'check' : 'alert', 18)}<span><b>Can I take this on?</b> ${v.text}</span></div>`;
      }
      pv.innerHTML = html;
      return e;
    };
    const refreshCps = () => { $('#cps', L.panel).innerHTML = cpRows(); show(); };
    form.addEventListener('input', ev => {
      const x = ev.target;
      if (x.dataset.cp != null) { d.checkpoints[+x.dataset.cp][x.dataset.f] = x.value; touched.add('cps'); }
      else if (x.name) { touched.add(['startPage', 'endPage', 'currentPage'].includes(x.name) ? 'pages' : x.name); }
      read(); show();
    });
    form.addEventListener('submit', ev => ev.preventDefault());
    L.panel.addEventListener('click', ev => {
      const x = ev.target.closest('button'); if (!x) return;
      if (x.dataset.type) {
        d.type = x.dataset.type; form.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('on', b === x));
        const lbl = form.elements.deadline.closest('.fld').querySelector('span'); lbl.textContent = d.type === 'library' ? 'Due date' : 'Deadline';
        if (d.type === 'club' && !d.checkpoints.length) { d.checkpoints.push({ page: '', date: addDays(t, 7), label: 'Next meeting' }); refreshCps(); }
        show();
      } else if (x.dataset.rday != null) {
        const k = +x.dataset.rday; d.readingDays[k] = !d.readingDays[k]; x.classList.toggle('on', d.readingDays[k]); touched.add('days'); show();
      } else if (x.dataset.preset) {
        const p = x.dataset.preset;
        d.readingDays = [0, 1, 2, 3, 4, 5, 6].map(k => p === 'all' || (p === 'wk' ? k > 0 && k < 6 : k === 0 || k === 6));
        form.querySelectorAll('[data-rday]').forEach(b => b.classList.toggle('on', d.readingDays[+b.dataset.rday])); show();
      } else if (x.dataset.buf) {
        d.bufferDays = Math.max(0, Math.min(30, d.bufferDays + int(x.dataset.buf, 0))); $('#bufV', L.panel).textContent = d.bufferDays; show();
      } else if (x.dataset.color) {
        d.color = x.dataset.color; form.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', b === x));
      } else if (x.id === 'addCp') {
        d.checkpoints.push({ page: '', date: addDays(t, 7), label: '' }); refreshCps();
        const last = form.querySelectorAll('[data-f="page"]'); if (last.length) last[last.length - 1].focus();
      } else if (x.dataset.cprm != null) {
        d.checkpoints.splice(+x.dataset.cprm, 1); refreshCps();
      } else if (x.id === 'saveBook') {
        if (L.done) return;
        read(); tried = true;
        const e = show();
        if (Object.keys(e).length) {
          const first = form.querySelector('.err:not(:empty)'); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          vibrate(30); return;
        }
        L.done = true;
        saveBook(ex, build());
      }
    });
    show();
    if (!ex) setTimeout(() => { try { form.elements.title.focus(); } catch (e) { /* ignore */ } }, 320);
  }

  function saveBook(ex, b) {
    const t = today();
    if (ex) {
      const sod = C.startOfDay(ex, t);
      const changed = ex.deadline !== b.deadline || ex.endPage !== b.endPage || ex.startPage !== b.startPage || ex.currentPage !== b.currentPage ||
        JSON.stringify(ex.readingDays) !== JSON.stringify(b.readingDays) || ex.bufferDays !== b.bufferDays || JSON.stringify(ex.checkpoints) !== JSON.stringify(b.checkpoints);
      Object.assign(ex, { title: b.title, author: b.author, type: b.type, color: b.color, startPage: b.startPage, endPage: b.endPage, currentPage: b.currentPage,
        deadline: b.deadline, readingDays: b.readingDays, bufferDays: b.bufferDays, checkpoints: b.checkpoints });
      if (changed) ex.planFrom = { date: t, page: Math.min(sod, ex.currentPage) };
      persist(); closeTop(); render(); toast('Saved');
      if (ex.status === 'active' && ex.currentPage >= ex.endPage) setTimeout(() => promptFinish(ex), 350);
    } else {
      const nb = Object.assign(b, { id: uid('b'), status: 'active', finishedAt: null, renewals: [], createdAt: t, planFrom: { date: t, page: b.currentPage } });
      S.books.push(nb);
      persist(); closeTop();
      if (tab !== 'today') tab = 'today';
      render();
      const i = C.info(nb, t);
      toast(i.need ? `Added · ${i.need} pages/day` : 'Added');
      if (nb.currentPage >= nb.endPage) setTimeout(() => promptFinish(nb), 350);
    }
  }

  // ---------- Actions ----------
  function renew(b, days) {
    const t = today();
    const base = b.deadline < t ? t : b.deadline;
    const nd = addDays(base, days);
    b.renewals.push({ date: t, oldDeadline: b.deadline, newDeadline: nd });
    b.deadline = nd;
    b.planFrom = { date: t, page: C.startOfDay(b, t) };
    persist(); render(); vibrate(20);
    toast(`${b.type === 'library' ? 'Renewed' : 'Extended'} · now due ${fmtD(nd)}`);
  }
  function setStatus(b, st) {
    const lbl = st === 'returned' ? 'Return unread' : 'Abandon';
    dialog({ icon: st === 'returned' ? 'undo' : 'book', title: `${lbl} “${esc(short(b.title))}”?`,
      body: `<p>${st === 'returned' ? 'It moves to your shelf as returned and stops counting toward your daily pages. It won’t count as finished.' : 'It moves to your shelf and stops counting toward your daily pages.'}</p>`,
      actions: [{ label: 'Cancel' }, { label: lbl, kind: 'primary', fn: () => {
        b.status = st; b.finishedAt = today();
        if (S.timer && S.timer.bookId === b.id) S.timer = null;
        persist();
        if (layers.length && layers[layers.length - 1].id === b.id) closeTop();
        render(); toast(st === 'returned' ? 'Marked returned' : 'Set aside');
      } }] });
  }

  const ACT = {
    close: () => closeTop(),
    tab: el => { closeAll(); setTab(el.dataset.tab); },
    add: () => openEdit(null),
    detail: el => openDetail(el.dataset.id),
    edit: el => openEdit(el.dataset.id),
    log: el => openLog(el.dataset.id),
    finish: el => { const b = byId(el.dataset.id); if (!b) return;
      if (b.currentPage < b.endPage) dialog({ icon: 'check', tone: 'ok', title: 'Mark as finished?', body: `<p>You're on p. ${b.currentPage} of ${b.endPage}. Finishing moves <b>${esc(b.title)}</b> to your shelf.</p>`,
        actions: [{ label: 'Cancel' }, { label: 'Finished', kind: 'primary', fn: () => { b.currentPage = b.endPage; finishBook(b); } }] });
      else finishBook(b); },
    status: el => { const b = byId(el.dataset.id); if (b) setStatus(b, el.dataset.st); },
    reopen: el => { const b = byId(el.dataset.id); if (!b) return; const t = today();
      b.status = 'active'; b.finishedAt = null;
      if (b.deadline <= t) { b.renewals.push({ date: t, oldDeadline: b.deadline, newDeadline: addDays(t, S.settings.loanLengthDays) }); b.deadline = addDays(t, S.settings.loanLengthDays); }
      if (b.currentPage >= b.endPage) b.currentPage = b.endPage - 1;
      b.planFrom = { date: t, page: b.currentPage };
      persist(); render(); toast('Back on your reading list'); },
    delete: el => { const b = byId(el.dataset.id); if (!b) return;
      dialog({ icon: 'trash', tone: 'bad', title: 'Delete this book?', body: `<p><b>${esc(b.title)}</b> and its ${plural(S.sessions.filter(s => s.bookId === b.id).length, 'session')} will be removed for good.</p>`,
        actions: [{ label: 'Cancel' }, { label: 'Delete', kind: 'danger', fn: () => {
          S.books = S.books.filter(x => x.id !== b.id); S.sessions = S.sessions.filter(s => s.bookId !== b.id);
          if (S.timer && S.timer.bookId === b.id) S.timer = null;
          persist(); if (layers.length && layers[layers.length - 1].id === b.id) closeTop(); render(); toast('Book deleted'); } }] }); },
    renew: el => { const b = byId(el.dataset.id); if (b) renew(b, int(el.dataset.days, 14)); },
    undoSession: el => { const s = S.sessions.find(x => x.id === el.dataset.id); if (!s) return; const b = byId(s.bookId);
      if (b) b.currentPage = s.fromPage; S.sessions = S.sessions.filter(x => x !== s); persist(); render(); toast('Session removed'); },
    timerStart: el => { S.timer = { bookId: el.dataset.id, start: Date.now() }; persist(); render(); vibrate(15); toast('Timer started — happy reading'); },
    timerStop: el => { const mins = S.timer ? Math.max(1, Math.round((Date.now() - S.timer.start) / 60000)) : null; S.timer = null; persist(); render(); openLog(el.dataset.id, mins); },
    takeon: () => {
      const p = int($('#tioPages').value, NaN), due = $('#tioDue').value, t = today();
      tio.pages = $('#tioPages').value; tio.due = due;
      if (isNaN(p) || p < 1) { tio.result = { ok: false, text: 'Enter how many pages the new book has.' }; }
      else if (!validDate(due) || due <= t) { tio.result = { ok: false, text: 'Pick a due date after today.' }; }
      else tio.result = takeOnVerdict(p, due, t);
      render();
    },
    shareSummary: () => shareText(summaryText()),
    setDay: el => { const k = +el.dataset.i; S.settings.readingDays[k] = !S.settings.readingDays[k];
      if (!S.settings.readingDays.some(Boolean)) { S.settings.readingDays[k] = true; toast('Keep at least one reading day'); }
      persist(); render(); },
    setNum: el => { const k = el.dataset.k, v = S.settings[k] + int(el.dataset.d, 0);
      S.settings[k] = k === 'bufferDays' ? Math.max(0, Math.min(30, v)) : Math.max(7, Math.min(63, v)); persist(); render(); },
    theme: el => { S.settings.theme = el.dataset.v; persist(); render(); },
    copyExport: () => copyText(JSON.stringify(S), 'Backup copied — paste it somewhere safe'),
    shareExport: () => shareText(JSON.stringify(S)),
    import: () => {
      const txt = $('#importBox').value.trim(); importText = txt;
      const err = $('#importErr');
      if (!txt) { err.textContent = 'Paste your backup JSON first.'; return; }
      let data;
      try { data = RL.normalize(JSON.parse(txt)); } catch (e) { err.textContent = 'That doesn’t look like a Readline backup. Check you copied all of it.'; return; }
      dialog({ icon: 'alert', tone: 'warn', title: 'Replace your data?', body: `<p>Import ${plural(data.books.length, 'book')} and ${plural(data.sessions.length, 'session')}. Your current data will be replaced.</p>`,
        actions: [{ label: 'Cancel' }, { label: 'Import', kind: 'primary', fn: () => { S = data; C = RL.makeCalc(S); importText = ''; persist(); render(); toast('Backup restored'); } }] });
    },
    reset: () => dialog({ icon: 'trash', tone: 'bad', title: 'Reset everything?', body: '<p>All books, sessions, renewals and settings will be erased. Export a backup first if you might want them back.</p>',
      actions: [{ label: 'Cancel' }, { label: 'Erase all', kind: 'danger', fn: () => { S = RL.defaults(); C = RL.makeCalc(S); persist(); render(); toast('All data erased'); } }] }),
    sample: () => dialog({ icon: 'book', title: 'Load sample books?', body: '<p>Replaces your current data with a few example deadlines so you can explore.</p>',
      actions: [{ label: 'Cancel' }, { label: 'Load samples', kind: 'primary', fn: () => { const s = RL.seed(RL.defaults()); s.settings = S.settings; S = s; C = RL.makeCalc(S); persist(); render(); toast('Sample books loaded'); } }] })
  };

  // Actions that open a page/sheet/dialog: ignore double-taps that would stack a second copy.
  const OPENERS = new Set(['add', 'detail', 'edit', 'log', 'finish', 'status', 'delete', 'reset', 'sample', 'timerStop']);
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (!a || a.disabled) return;
    if (a.closest('.layer.out')) return;
    if (OPENERS.has(a.dataset.act) && Date.now() - lastPush < 350) return;
    const fn = ACT[a.dataset.act];
    if (fn) fn(a, e);
  });

  // Timer tick
  setInterval(() => {
    if (!S.timer) return;
    const s = Math.floor((Date.now() - S.timer.start) / 1000);
    const txt = (s >= 3600 ? Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') : Math.floor(s / 60)) + ':' + String(s % 60).padStart(2, '0');
    document.querySelectorAll('[data-timer]').forEach(el => { el.textContent = txt; });
  }, 1000);

  // Re-render when the day rolls over or the app returns to foreground
  let lastDay = today();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && today() !== lastDay) { lastDay = today(); render(); } });
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); render(); } }, 60000);

  window.onAndroidBack = function () {
    if (layers.length) { closeTop(); return true; }
    if (tab !== 'today') { setTab('today'); return true; }
    return false;
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.onAndroidBack(); });

  render();
})();
