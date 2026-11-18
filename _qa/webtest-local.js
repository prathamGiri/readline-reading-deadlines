// Local copy of pipeline/webtest.js that points Playwright at the installed Chromium build.
const { chromium } = require('C:/Users/Hp/OneDrive/Desktop/Auto Builder/pipeline/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

(async () => {
  const [www, outDir, scenario] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Users/Hp/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: process.env.SCHEME || 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
  let n = 0;
  const shot = async (name) => {
    const f = path.join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: f });
    return f;
  };
  const report = { ok: true, errors, screenshots: [], scenarioError: null };
  try {
    await page.goto(pathToFileURL(path.join(www, 'index.html')).href);
    await page.waitForTimeout(800);
    report.screenshots.push(await shot('initial'));
    if (scenario) {
      const run = require(path.resolve(scenario));
      await run(page, async (name) => report.screenshots.push(await shot(name)));
    }
  } catch (e) {
    report.scenarioError = String(e && e.stack || e);
  }
  report.ok = errors.length === 0 && !report.scenarioError;
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(report.ok ? 0 : 1);
})();
