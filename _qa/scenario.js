module.exports = async (page, shot) => {
  const w = (ms = 450) => page.waitForTimeout(ms);
  const day = n => page.evaluate(n => RL.addDays(RL.today(), n), n);
  const assert = (c, m) => { if (!c) throw new Error('Assertion failed: ' + m); };

  // Today, scrolled
  await page.evaluate(() => document.querySelector('#screen').scrollTo(0, 700)); await w(); await shot('today-cards');

  // Plan / triage
  await page.click('#tabbar [data-tab=plan]'); await w(); await shot('plan-triage');
  await page.evaluate(() => document.querySelector('.cal').scrollIntoView()); await w(); await shot('plan-calendar');
  await page.fill('#tioPages', '500'); await page.fill('#tioDue', await day(5));
  await page.click('[data-act=takeon]'); await w();
  const verdict = await page.textContent('.takeon .verdict');
  assert(/Won't fit/.test(verdict), 'take-on verdict should be won\'t fit: ' + verdict);
  await page.evaluate(() => document.querySelector('.takeon').scrollIntoView()); await w(); await shot('take-on-wont-fit');

  // Renew suggestion from triage
  const renewBtn = await page.$('.sug [data-act=renew]');
  if (renewBtn) { await renewBtn.click(); await w(); }

  // Shelf + settings
  await page.click('#tabbar [data-tab=shelf]'); await w(); await shot('shelf');
  await page.click('#tabbar [data-tab=settings]'); await w(); await shot('settings');

  // Add-book validation
  await page.click('#tabbar [data-tab=today]'); await w();
  await page.click('#fab'); await w();
  await page.fill('#bookForm [name=endPage]', '100');
  await page.fill('#bookForm [name=currentPage]', '150');
  await page.click('#saveBook'); await w();
  const errs = await page.$$eval('#bookForm .err', els => els.map(e => e.textContent).filter(Boolean));
  assert(errs.some(e => /title/.test(e)) && errs.some(e => /past the last page/.test(e)), 'validation errors: ' + errs.join('|'));
  await page.evaluate(() => document.querySelector('.layer.page .panel').scrollTo(0, 0)); await w(); await shot('add-validation');

  // Scenario 1: 300 pages, due in 10 days -> 30/day
  await page.fill('#bookForm [name=title]', 'The Remains of the Day');
  await page.fill('#bookForm [name=author]', 'Kazuo Ishiguro');
  await page.fill('#bookForm [name=endPage]', '300');
  await page.fill('#bookForm [name=currentPage]', '0');
  await page.fill('#bookForm [name=deadline]', await day(10));
  await w(200);
  const pv = await page.textContent('#preview');
  assert(/30 pages\/day/.test(pv.replace(/\s+/g, ' ')) && /p\. 30/.test(pv), 'preview 30/day: ' + pv);
  await page.evaluate(() => document.querySelector('#preview').scrollIntoView({ block: 'center' })); await w(); await shot('add-preview');
  await page.click('#saveBook'); await w(700);

  // Open detail and log page 50
  await page.click('.book:has-text("The Remains of the Day")'); await w();
  await shot('detail');
  await page.click('.layer.page [data-act=log]'); await w();
  await page.fill('#logPage', '50'); await page.fill('#logMin', '60');
  await shot('log-sheet');
  await page.click('#logSave'); await w(700);
  const txt = await page.textContent('.layer.page .panel');
  assert(/Ahead by 20/.test(txt), 'status Ahead by 20');
  assert(/Tomorrow ≈ 28 pages/.test(txt), 'tomorrow 28 pages');
  await shot('detail-after-log');

  // Timer, then log 20 pages
  await page.click('[data-act=timerStart]'); await w(1600);
  await page.click('[data-act=timerStop]'); await w();
  await page.click('[data-q="10"]'); await page.click('[data-q="10"]');
  const v = await page.inputValue('#logPage'); assert(v === '70', 'quick add -> 70, got ' + v);
  await page.click('#logSave'); await w(700);

  // Renew +14
  await page.click('.layer.page [data-act=renew]'); await w();
  const t2 = await page.textContent('.layer.page .panel');
  assert(/Renewed/.test(t2), 'renewal entry');
  await page.evaluate(() => document.querySelector('.layer.page .renews').scrollIntoView({ block: 'center' })); await w(); await shot('detail-renewed');

  // Mark finished
  await page.click('.layer.page [data-act=finish]'); await w();
  await shot('finish-dialog');
  await page.click('.layer.dialog [data-dlg="1"]'); await w(800);
  await page.click('#tabbar [data-tab=shelf]'); await w();
  const shelf = await page.textContent('#screen');
  assert(/The Remains of the Day/.test(shelf) && /On time/.test(shelf), 'finished on shelf');

  // Persistence after reload
  await page.reload(); await w(800);
  await page.click('#tabbar [data-tab=shelf]'); await w();
  assert(/The Remains of the Day/.test(await page.textContent('#screen')), 'persisted after reload');

  // Export -> reset -> import
  await page.click('#tabbar [data-tab=settings]'); await w();
  const json = await page.inputValue('#exportBox');
  await page.click('[data-act=reset]'); await w(); await page.click('.layer.dialog [data-dlg="1"]'); await w();
  await page.click('#tabbar [data-tab=today]'); await w(); await shot('empty-state');
  await page.click('#tabbar [data-tab=settings]'); await w();
  await page.fill('#importBox', json); await page.click('[data-act=import]'); await w();
  await page.click('.layer.dialog [data-dlg="1"]'); await w();
  await page.click('#tabbar [data-tab=shelf]'); await w();
  assert(/The Remains of the Day/.test(await page.textContent('#screen')), 'restored after import');

  // Dark mode
  await page.click('#tabbar [data-tab=settings]'); await w();
  await page.click('[data-act=theme][data-v=dark]'); await w();
  await page.click('#tabbar [data-tab=today]'); await w(); await shot('today-dark');
  await page.click('.book'); await w(); await shot('detail-dark');
  const back = await page.evaluate(() => window.onAndroidBack()); assert(back === true, 'back closes detail');
  await w();

  // ================= Extended QA coverage =================
  const T = await page.evaluate(() => RL.today());
  const go = async tb => { await page.evaluate(() => { while (window.onAndroidBack && document.querySelector('#layers .layer:not(.out)')) window.onAndroidBack(); }); await w(350); await page.click(`#tabbar [data-tab=${tb}]`); await w(); };
  const state = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), 'readline.v1');
  const resetAll = async () => { await go('settings'); await page.click('[data-act=reset]'); await w(); await page.click('.layer.dialog [data-dlg="1"]'); await w(); };
  async function addBook(o) {
    await go('today');
    await page.click('#fab'); await w();
    const f = '#bookForm ';
    if (o.type) { await page.click(`${f}[data-type=${o.type}]`); await w(150); }
    await page.fill(f + '[name=title]', o.title);
    await page.fill(f + '[name=endPage]', String(o.pages));
    await page.fill(f + '[name=currentPage]', String(o.current || 0));
    await page.fill(f + '[name=deadline]', await day(o.due));
    if (o.cp) {
      if (!(await page.$(f + '[data-cp="0"][data-f=page]'))) { await page.click('#addCp'); await w(150); }
      await page.fill(f + '[data-cp="0"][data-f=page]', String(o.cp.page));
      await page.fill(f + '[data-cp="0"][data-f=date]', await day(o.cp.in));
    }
    await w(200);
    const pv = (await page.textContent('#preview')).replace(/\s+/g, ' ');
    if (o.shotName) { await page.evaluate(() => document.querySelector('#preview').scrollIntoView({ block: 'center' })); await w(); await shot(o.shotName); }
    if (o.noSave) return pv;
    await page.click('#saveBook'); await w(700);
    return pv;
  }

  // Light theme again, fresh data
  await go('settings'); await page.click('[data-act=theme][data-v=light]'); await w();
  await resetAll();

  // --- Scenario 2: weekdays only + 2-day buffer ---
  await go('settings');
  await page.click('[data-act=setDay][data-i="0"]'); await w(150);
  await page.click('[data-act=setDay][data-i="6"]'); await w(150);
  await page.click('[data-act=setNum][data-k=bufferDays][data-d="1"]'); await w(150);
  await page.click('[data-act=setNum][data-k=bufferDays][data-d="1"]'); await w(150);
  let s = await state();
  assert(JSON.stringify(s.settings.readingDays) === JSON.stringify([false, true, true, true, true, true, false]) && s.settings.bufferDays === 2, 'settings weekdays+buffer2 saved');
  const expWk = await page.evaluate(() => { const t = RL.today(), end = RL.addDays(RL.addDays(t, 14), -2); let c = 0; for (let d = t; d < end; d = RL.addDays(d, 1)) { const w = RL.dow(d); if (w > 0 && w < 6) c++; } return { c, per: Math.ceil(140 / c), wk: RL.dow(t) > 0 && RL.dow(t) < 6 }; });
  const pvWk = await addBook({ title: 'Weekday Reader', pages: 140, due: 14 });
  assert(pvWk.includes(expWk.per + ' pages/day') && pvWk.includes(expWk.c + ' reading days'), `weekday target ${expWk.per}/day over ${expWk.c} days; preview: ${pvWk}`);
  await go('plan');
  const weekendRows = await page.$$eval('.cal .drow:not(.past)', rows => rows.filter(r => /Sat|Sun/.test(r.querySelector('.dl b').textContent)).map(r => r.querySelector('.dn').textContent.trim()));
  assert(weekendRows.length >= 2 && weekendRows.every(v => v === '0'), 'weekend rows should be 0: ' + weekendRows.join(','));
  await page.evaluate(() => document.querySelector('.cal').scrollIntoView()); await w(); await shot('weekday-plan');
  // restore settings
  await go('settings');
  await page.click('[data-act=setDay][data-i="0"]'); await page.click('[data-act=setDay][data-i="6"]');
  await page.click('[data-act=setNum][data-k=bufferDays][data-d="-1"]'); await page.click('[data-act=setNum][data-k=bufferDays][data-d="-1"]'); await w();
  await resetAll();

  // --- Scenario 3: deadline tomorrow, 400 pages -> impossible, renew drops target ---
  await addBook({ title: 'Due Tomorrow Tome', pages: 400, due: 1 });
  let todayTxt = await page.textContent('#screen');
  assert(/Impossible at your pace/.test(todayTxt), 'impossible status shown');
  assert(/at risk/.test(todayTxt), 'at-risk banner shown');
  await go('plan');
  const renewSug = await page.$('.sug [data-act=renew]');
  assert(renewSug, 'triage suggests renew');
  await shot('impossible-triage');
  await go('today');
  await page.click('.book:has-text("Due Tomorrow Tome")'); await w();
  const before = await page.textContent('.layer.page .tgt-meta b');
  await page.click('.layer.page [data-act=renew][data-days="14"]'); await w(600);
  const after = await page.textContent('.layer.page .tgt-meta b');
  assert(+after < +before, `target should drop after renew: ${before} -> ${after}`);
  assert(/Renewed/.test(await page.textContent('.layer.page .renews')), 'renewal entry in detail');
  s = await state();
  assert(s.books[0].deadline === await day(15) && s.books[0].renewals.length === 1, 'deadline moved +14');

  // --- Scenario 4: three overlapping books; total sums; take-on won't fit ---
  await resetAll();
  await addBook({ title: 'Overlap One', pages: 200, due: 7 });
  await addBook({ title: 'Overlap Two', pages: 150, due: 9 });
  await addBook({ title: 'Overlap Three', pages: 320, due: 12 });
  const sums = await page.evaluate(() => {
    const hero = parseInt(document.querySelector('.hero-num').textContent, 10);
    const cards = [...document.querySelectorAll('.book .tgt-meta b')].map(b => parseInt(b.textContent, 10));
    return { hero, cards };
  });
  const exp4 = [Math.ceil(200 / 7), Math.ceil(150 / 9), Math.ceil(320 / 12)];
  assert(sums.cards.length === 3 && sums.hero === sums.cards.reduce((a, b) => a + b, 0), 'hero sum ' + JSON.stringify(sums));
  assert(sums.hero === exp4.reduce((a, b) => a + b, 0), `hero ${sums.hero} expected ${exp4.join('+')}`);
  await shot('three-books');
  await go('plan');
  await page.fill('#tioPages', '500'); await page.fill('#tioDue', await day(5));
  await page.click('[data-act=takeon]'); await w();
  const v4 = await page.textContent('.takeon .verdict');
  assert(/Won't fit/.test(v4) && /Overlap/.test(v4), 'won\'t fit verdict names conflict: ' + v4);

  // --- Scenario 5: book-club checkpoint ---
  await resetAll();
  const pvCp = await addBook({ type: 'club', title: 'Club Pick', pages: 300, due: 20, cp: { page: 120, in: 4 }, shotName: 'checkpoint-preview' });
  assert(/30 pages\/day/.test(pvCp) && /aiming at p\. 120/.test(pvCp), 'checkpoint target 30/day: ' + pvCp);
  const cardCp = await page.textContent('.book');
  assert(/p\.\s*30/.test(cardCp) && /toward p\. 120/.test(cardCp), 'card aims at checkpoint: ' + cardCp.replace(/\s+/g, ' '));

  // --- Scenario 6: timer -> pace & time estimate ---
  await page.click('.book'); await w();
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('readline.v1')); });
  await page.click('[data-act=timerStart]'); await w(1200);
  await page.click('[data-act=timerStop]'); await w();
  await page.fill('#logPage', '20'); await page.fill('#logMin', '25');
  await page.click('#logSave'); await w(700);
  const dt6 = await page.textContent('.layer.page .panel');
  assert(/Your pace: 0\.80 pages\/min/.test(dt6), 'pace estimate 0.80 ppm');
  await go('today');
  assert(/≈ \d+ min/.test(await page.textContent('.book')), 'time estimate on card');

  // --- Scenario 7: finish + returned unread excluded ---
  await addBook({ title: 'To Be Returned', pages: 250, due: 10 });
  await go('shelf');
  const finBefore = await page.textContent('.stats .stat b');
  await go('today');
  await page.click('.book:has-text("To Be Returned")'); await w();
  await page.click('.layer.page [data-act=status][data-st=returned]'); await w();
  await page.click('.layer.dialog [data-dlg="1"]'); await w(700);
  await go('shelf');
  const shelf7 = await page.textContent('#screen');
  assert(/Returned unread/.test(shelf7), 'returned on shelf');
  assert((await page.textContent('.stats .stat b')) === finBefore, 'returned excluded from finished count');

  // --- Scenario 9: validation edge cases ---
  await go('today'); await page.click('#fab'); await w();
  await page.fill('#bookForm [name=title]', '   ');
  await page.fill('#bookForm [name=endPage]', '100');
  await page.fill('#bookForm [name=deadline]', await day(-3));
  await page.click('#saveBook'); await w();
  const errs9 = await page.$$eval('#bookForm .err', els => els.map(e => e.textContent).filter(Boolean));
  assert(errs9.some(e => /title/.test(e)) && errs9.some(e => /already passed/.test(e)), 'title + past date validation: ' + errs9.join('|'));
  await page.evaluate(() => window.onAndroidBack()); await w(400);
  // 0 pages remaining -> finish prompt
  await addBook({ title: 'Already Done', pages: 80, current: 80, due: 5 });
  await w(400);
  assert(/last page/.test(await page.textContent('.layer.dialog')), 'auto finish prompt for 0 remaining');
  await shot('auto-finish-prompt');
  await page.click('.layer.dialog [data-dlg="1"]'); await w(700);
  await go('shelf');
  assert(/Already Done/.test(await page.textContent('#screen')), 'auto-finished book on shelf');

  // --- Edge: very long title, no horizontal overflow ---
  const longT = 'An Extraordinarily Long Title '.repeat(10) + 'Supercalifragilisticexpialidociousandevenlongerwordwithnobreaks';
  await addBook({ title: longT, pages: 300, due: 10 });
  const ovf = await page.evaluate(() => { const sc = document.querySelector('#screen'); const cards = [...document.querySelectorAll('.book')]; return { sc: sc.scrollWidth - sc.clientWidth, card: cards.map(c => c.scrollWidth - c.clientWidth) }; });
  assert(ovf.sc <= 1 && ovf.card.every(x => x <= 1), 'long title overflow ' + JSON.stringify(ovf));
  await shot('long-title');
  await page.click('.book'); await w();
  const ovfD = await page.evaluate(() => { const p = document.querySelector('.layer.page .panel'); return p.scrollWidth - p.clientWidth; });
  assert(ovfD <= 1, 'detail overflow ' + ovfD);
  await shot('long-title-detail');
  await go('plan');
  const ovfP = await page.evaluate(() => { const sc = document.querySelector('#screen'); return sc.scrollWidth - sc.clientWidth; });
  assert(ovfP <= 1, 'plan overflow ' + ovfP);

  // --- Edge: rapid taps ---
  await resetAll();
  await go('today');
  await page.evaluate(() => { const f = document.querySelector('#fab'); f.click(); f.click(); f.click(); });
  await w();
  const nForms = await page.locator('#layers .layer.page:not(.out)').count();
  assert(nForms === 1, 'rapid FAB taps opened ' + nForms + ' forms');
  await page.fill('#bookForm [name=title]', 'Rapid Save');
  await page.fill('#bookForm [name=endPage]', '120');
  await page.evaluate(() => { const b = document.querySelector('#saveBook'); b.click(); b.click(); b.click(); });
  await w(700);
  s = await state();
  assert(s.books.filter(b => b.title === 'Rapid Save').length === 1, 'rapid save created ' + s.books.filter(b => b.title === 'Rapid Save').length + ' books');
  // rapid log
  await page.click('.book'); await w();
  await page.click('.layer.page [data-act=log]'); await w();
  await page.fill('#logPage', '30');
  await page.evaluate(() => { const b = document.querySelector('#logSave'); b.click(); b.click(); });
  await w(700);
  s = await state();
  assert(s.sessions.length === 1, 'rapid log created ' + s.sessions.length + ' sessions');

  // --- Reload persistence of sessions/renewals/settings ---
  await page.click('.layer.page [data-act=renew][data-days="14"]'); await w();
  await go('settings'); await page.click('[data-act=setNum][data-k=loanLengthDays][data-d="7"]'); await w();
  await page.reload(); await w(800);
  s = await state();
  assert(s.books[0].renewals.length === 1 && s.sessions.length === 1 && s.settings.loanLengthDays === 21, 'reload persistence');
  await page.click('.book'); await w();
  assert(/Renewed/.test(await page.textContent('.layer.page .panel')) && /p\. 0 → 30/.test(await page.textContent('.layer.page .panel')), 'detail after reload');

  // --- Back handler chain ---
  await page.click('.layer.page [data-act=log]'); await w();
  assert(await page.evaluate(() => window.onAndroidBack()) === true, 'back closes sheet'); await w(400);
  assert(await page.evaluate(() => window.onAndroidBack()) === true, 'back closes detail'); await w(400);
  await page.click('#tabbar [data-tab=plan]'); await w();
  assert(await page.evaluate(() => window.onAndroidBack()) === true, 'back goes to today'); await w(400);
  assert(await page.evaluate(() => window.onAndroidBack()) === false, 'back on today exits');

  // --- Import garbage ---
  await go('settings');
  await page.fill('#importBox', '{not json'); await page.click('[data-act=import]'); await w();
  assert(/doesn’t look like/.test(await page.textContent('#importErr')), 'bad import error');
  await page.fill('#importBox', ''); await page.click('[data-act=import]'); await w();
  assert(/Paste/.test(await page.textContent('#importErr')), 'empty import error');
};
