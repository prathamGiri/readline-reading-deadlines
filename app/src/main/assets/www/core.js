/* Readline core: dates, storage, and all derived reading math (no DOM). */
(function (global) {
  'use strict';

  // ---------- Dates (local YYYY-MM-DD strings; compare lexicographically) ----------
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const today = () => ymd(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5); // b - a in days
  const dow = s => parse(s).getDay();
  const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(parse(s).getTime());

  // ---------- State ----------
  const KEY = 'readline.v1';
  const ALL_DAYS = [true, true, true, true, true, true, true];

  function defaults() {
    return {
      settings: { readingDays: ALL_DAYS.slice(), bufferDays: 0, loanLengthDays: 14, theme: 'system' },
      books: [], sessions: [],
      streak: { current: 0, best: 0, lastHitDate: null, hitDates: [] },
      timer: null
    };
  }

  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const int = (v, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : n; };

  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.books)) throw new Error('Not a Readline backup');
    const s = defaults();
    const st = raw.settings || {};
    if (Array.isArray(st.readingDays) && st.readingDays.length === 7) s.settings.readingDays = st.readingDays.map(Boolean);
    s.settings.bufferDays = Math.max(0, int(st.bufferDays, 0));
    s.settings.loanLengthDays = Math.max(1, int(st.loanLengthDays, 14));
    if (['system', 'light', 'dark'].includes(st.theme)) s.settings.theme = st.theme;
    const t = today();
    s.books = raw.books.filter(b => b && b.title).map(b => {
      const startPage = Math.max(1, int(b.startPage, 1));
      const endPage = Math.max(startPage, int(b.endPage, startPage));
      const currentPage = Math.min(endPage, Math.max(startPage - 1, int(b.currentPage, startPage - 1)));
      const createdAt = validDate(b.createdAt) ? b.createdAt : t;
      return {
        id: String(b.id || uid('b')), title: String(b.title), author: String(b.author || ''),
        color: String(b.color || '#C2410C'),
        type: ['library', 'club', 'class', 'goal'].includes(b.type) ? b.type : 'goal',
        startPage, endPage, currentPage, createdAt,
        deadline: validDate(b.deadline) ? b.deadline : addDays(t, 14),
        readingDays: Array.isArray(b.readingDays) && b.readingDays.length === 7 ? b.readingDays.map(Boolean) : null,
        bufferDays: b.bufferDays == null ? null : Math.max(0, int(b.bufferDays, 0)),
        status: ['active', 'finished', 'returned', 'abandoned'].includes(b.status) ? b.status : 'active',
        finishedAt: validDate(b.finishedAt) ? b.finishedAt : null,
        renewals: Array.isArray(b.renewals) ? b.renewals.filter(r => r && validDate(r.newDeadline)) : [],
        checkpoints: Array.isArray(b.checkpoints) ? b.checkpoints.filter(c => c && validDate(c.date)).map(c => ({ page: int(c.page, endPage), date: c.date, label: String(c.label || '') })) : [],
        planFrom: b.planFrom && validDate(b.planFrom.date) ? { date: b.planFrom.date, page: int(b.planFrom.page, currentPage) } : { date: createdAt, page: startPage - 1 }
      };
    });
    const ids = new Set(s.books.map(b => b.id));
    s.sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).filter(x => x && ids.has(x.bookId) && validDate(x.date)).map(x => ({
      id: String(x.id || uid('s')), bookId: x.bookId, date: x.date,
      fromPage: int(x.fromPage, 0), toPage: int(x.toPage, 0),
      minutes: x.minutes == null || x.minutes === '' ? null : Math.max(0, Number(x.minutes) || 0), at: x.at || null
    }));
    const k = raw.streak || {};
    s.streak = { current: int(k.current, 0), best: int(k.best, 0), lastHitDate: validDate(k.lastHitDate) ? k.lastHitDate : null, hitDates: Array.isArray(k.hitDates) ? k.hitDates.filter(validDate) : [] };
    s.timer = raw.timer && ids.has(raw.timer.bookId) ? { bookId: raw.timer.bookId, start: Number(raw.timer.start) || Date.now() } : null;
    return s;
  }

  function seed(s) {
    const T = today(), d = n => addDays(T, n);
    const mk = (o) => Object.assign({ id: uid('b'), readingDays: null, bufferDays: null, status: 'active', finishedAt: null, renewals: [], checkpoints: [], startPage: 1 }, o);
    const pir = mk({ title: 'Piranesi', author: 'Susanna Clarke', color: '#C2410C', type: 'library', endPage: 272, currentPage: 82, createdAt: d(-8), deadline: d(6), planFrom: { date: d(-8), page: 0 } });
    const tom = mk({ title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin', color: '#2F5D8A', type: 'club', endPage: 416, currentPage: 140, createdAt: d(-6), deadline: d(16), planFrom: { date: d(-6), page: 0 },
      checkpoints: [{ page: 200, date: d(4), label: 'Club meeting · Parts I–III' }] });
    const doe = mk({ title: 'The Design of Everyday Things', author: 'Don Norman', color: '#0F766E', type: 'class', endPage: 368, currentPage: 52, createdAt: d(-2), deadline: d(19), planFrom: { date: d(-2), page: 0 },
      readingDays: [false, true, true, true, true, true, false], bufferDays: 2 });
    const kla = mk({ title: 'Klara and the Sun', author: 'Kazuo Ishiguro', color: '#7B4B6B', type: 'library', endPage: 303, currentPage: 303, createdAt: d(-30), deadline: d(-16), status: 'finished', finishedAt: d(-18), planFrom: { date: d(-30), page: 0 } });
    const edu = mk({ title: 'Educated', author: 'Tara Westover', color: '#B8860B', type: 'club', endPage: 334, currentPage: 334, createdAt: d(-44), deadline: d(-26), status: 'finished', finishedAt: d(-24), planFrom: { date: d(-44), page: 0 } });
    const phm = mk({ title: 'Project Hail Mary', author: 'Andy Weir', color: '#8B5E3C', type: 'library', endPage: 476, currentPage: 35, createdAt: d(-22), deadline: d(-8), status: 'returned', finishedAt: d(-9), planFrom: { date: d(-22), page: 0 },
      renewals: [] });
    s.books = [pir, tom, doe, kla, edu, phm];
    const ses = (b, day, f, t2, m) => s.sessions.push({ id: uid('s'), bookId: b.id, date: d(day), fromPage: f, toPage: t2, minutes: m, at: null });
    ses(pir, -5, 0, 28, 34); ses(pir, -4, 28, 55, 31); ses(pir, -2, 55, 82, 33);
    ses(tom, -6, 0, 34, 38); ses(tom, -5, 34, 70, 41); ses(tom, -3, 70, 104, null); ses(tom, -1, 104, 140, 40);
    ses(doe, -2, 0, 30, 52); ses(doe, -1, 30, 52, 38);
    ses(kla, -29, 0, 60, 70); ses(kla, -26, 60, 130, 75); ses(kla, -23, 130, 210, 90); ses(kla, -20, 210, 262, 55); ses(kla, -18, 262, 303, 45);
    ses(edu, -40, 0, 90, null); ses(edu, -33, 90, 200, null); ses(edu, -27, 200, 290, null); ses(edu, -24, 290, 334, null);
    ses(phm, -18, 0, 35, 40);
    s.streak = { current: 2, best: 6, lastHitDate: d(-1), hitDates: [d(-5), d(-2), d(-1)] };
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* fall through to fresh state */ }
    return seed(defaults());
  }
  function save(S) { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; } }

  // ---------- Reading math ----------
  function makeCalc(S) {
    const rd = b => (b && b.readingDays) || S.settings.readingDays;
    const isRD = (b, day) => !!rd(b)[dow(day)];
    function countRD(b, from, to) {
      const n = Math.min(diff(from, to), 3660); let c = 0; let d = from;
      for (let i = 0; i < n; i++) { if (isRD(b, d)) c++; d = addDays(d, 1); }
      return c;
    }
    const bufferOf = b => (b.bufferDays == null ? S.settings.bufferDays : b.bufferDays);
    function effEnd(b, t) {
      const e = addDays(b.deadline, -bufferOf(b));
      return e > t ? e : b.deadline;
    }
    function startOfDay(b, t) {
      let m = b.currentPage;
      for (const s of S.sessions) if (s.bookId === b.id && s.date === t && s.fromPage < m) m = s.fromPage;
      return m;
    }
    function segments(b, t, pos) {
      const end = effEnd(b, t);
      const cps = (b.checkpoints || []).filter(c => c.date > t && c.date <= b.deadline && c.page > pos && c.page < b.endPage)
        .sort((x, y) => (x.date < y.date ? -1 : 1));
      const segs = []; let last = pos;
      for (const c of cps) if (c.page > last) { segs.push({ page: c.page, end: c.date < end ? c.date : end, cp: c }); last = c.page; }
      segs.push({ page: b.endPage, end, cp: null });
      return segs;
    }
    // Planned pages per day from today. Day 0 starts at the start-of-day page.
    function planBook(b, t, n) {
      let pos = startOfDay(b, t);
      const segs = segments(b, t, pos);
      const out = [];
      for (let i = 0; i < n; i++) {
        const day = addDays(t, i);
        if (i === 1) pos = Math.max(pos, b.currentPage);
        let planned = 0;
        const seg = segs.find(s => s.end > day && s.page > pos);
        if (seg) {
          const left = countRD(b, day, seg.end);
          if (isRD(b, day)) planned = Math.ceil((seg.page - pos) / Math.max(1, left));
          else if (i === 0 && left === 0) planned = seg.page - pos;
        } else if (i === 0 && pos < b.endPage) {
          planned = b.endPage - pos; // due today or overdue: everything left is due
        }
        pos += planned;
        out.push({ date: day, planned, toPage: pos, seg });
      }
      return out;
    }

    function pace(t) {
      const from = addDays(t, -14), byDay = {};
      let readToday = 0, pm = 0, mm = 0;
      for (const s of S.sessions) {
        const p = Math.max(0, s.toPage - s.fromPage);
        if (s.date === t) readToday += p;
        else if (s.date >= from && s.date < t) byDay[s.date] = (byDay[s.date] || 0) + p;
        if (s.minutes > 0 && p > 0) { pm += p; mm += s.minutes; }
      }
      const days = Object.keys(byDay).length;
      const total = Object.values(byDay).reduce((a, x) => a + x, 0);
      let avgDay = days ? total / days : null;
      if (!avgDay && readToday) avgDay = readToday;
      const ppm = mm > 0 ? pm / mm : null;
      return { avgDay, ppm, readToday, days, assumed: !avgDay, P: avgDay ? Math.max(5, Math.round(avgDay)) : 40,
        capacity: avgDay ? Math.max(avgDay * 2, 60) : 150 };
    }

    function info(b, t, pc) {
      pc = pc || pace(t);
      const sod = startOfDay(b, t);
      const plan = planBook(b, t, 14);
      const p0 = plan[0];
      const target = p0.planned, readTo = p0.toPage;
      const remaining = Math.max(0, readTo - b.currentPage);
      const left = Math.max(0, b.endPage - b.currentPage);
      const total = b.endPage - b.startPage + 1;
      const pct = total > 0 ? Math.round(100 * (b.currentPage - (b.startPage - 1)) / total) : 0;
      const restDay = !isRD(b, t) && target === 0;
      const next = plan.find((p, i) => i > 0 && p.planned > 0) || null;
      const need = target > 0 ? target : (next ? next.planned : 0);
      const seg = segments(b, t, sod)[0];
      const daysLeft = diff(t, b.deadline);
      let status;
      if (left <= 0) status = { key: 'done', label: 'All read — mark finished?' };
      else if (daysLeft < 0) status = { key: 'over', label: 'Overdue · ' + (-daysLeft) + 'd' };
      else if (daysLeft === 0) status = { key: 'over', label: 'Due today' };
      else if (need > pc.capacity) status = { key: 'imp', label: 'Impossible at your pace' };
      else {
        let st = b.planFrom || { date: b.createdAt, page: b.startPage - 1 };
        for (const c of b.checkpoints || []) if (c.date <= t && c.date > st.date) st = { date: c.date, page: c.page };
        const tot = countRD(b, st.date, seg.end);
        status = { key: 'ok', label: 'On track' };
        if (tot > 0 && seg.page > st.page) {
          const done = countRD(b, st.date, t), incl = done + (isRD(b, t) ? 1 : 0);
          const expY = st.page + (seg.page - st.page) * done / tot;
          const expT = st.page + (seg.page - st.page) * incl / tot;
          if (b.currentPage >= expT + 1) status = { key: 'ahead', label: 'Ahead by ' + Math.floor(b.currentPage - expT) + ' pages' };
          else if (b.currentPage < expY - 1) status = { key: 'behind', label: 'Behind · catch up ' + need + '/day' };
        }
      }
      const minutes = pc.ppm && remaining > 0 ? Math.max(1, Math.round(remaining / pc.ppm)) : null;
      return { sod, plan, target, readTo, remaining, left, pct, restDay, next, need, seg, daysLeft, status, minutes, end: effEnd(b, t) };
    }

    // Earliest-deadline-first simulation at the reader's recent pace.
    function simulate(books, t, pc) {
      pc = pc || pace(t);
      const P = pc.P;
      const items = books.map(b => ({ b, rem: Math.max(0, b.endPage - b.currentPage), end: effEnd(b, t), doneOn: null }));
      let horizon = 0;
      for (const it of items) horizon = Math.max(horizon, diff(t, it.end));
      horizon = Math.min(horizon, 730);
      for (let i = 0; i < horizon; i++) {
        const day = addDays(t, i);
        let budget = i === 0 ? Math.max(0, P - pc.readToday) : P;
        const elig = items.filter(it => it.rem > 0 && it.end > day && isRD(it.b, day)).sort((x, y) => (x.end < y.end ? -1 : x.end > y.end ? 1 : 0));
        for (const it of elig) {
          if (budget <= 0) break;
          const take = Math.min(budget, it.rem); it.rem -= take; budget -= take;
          if (it.rem === 0) it.doneOn = day;
        }
      }
      const atRisk = items.filter(it => it.rem > 0).map(it => ({ b: it.b, short: it.rem, end: it.end }));
      const order = items.filter(it => it.b.endPage > it.b.currentPage).sort((x, y) => (x.end < y.end ? -1 : 1)).map(it => it.b);
      return { fits: atRisk.length === 0, atRisk, order, P, assumed: pc.assumed, items };
    }

    function latestSessionId(bookId) {
      let best = null;
      for (const s of S.sessions) if (s.bookId === bookId && (!best || s.date > best.date || (s.date === best.date && (s.at || 0) >= (best.at || 0)))) best = s;
      return best ? best.id : null;
    }

    return { isRD, countRD, effEnd, startOfDay, segments, planBook, pace, info, simulate, bufferOf, latestSessionId };
  }

  global.RL = { ymd, parse, today, addDays, diff, dow, validDate, uid, int, KEY, defaults, normalize, seed, load, save, makeCalc };
})(window);
