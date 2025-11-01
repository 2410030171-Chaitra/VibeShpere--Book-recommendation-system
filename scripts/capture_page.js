// Lightweight Playwright script to capture console messages and a screenshot
// Usage: node scripts/capture_page.js http://127.0.0.1:5173/ output.png
const url = process.argv[2] || 'http://127.0.0.1:5173/'
const out = process.argv[3] || '/tmp/vibesphere_capture.png'

(async ()=>{
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
      console.log(`[console:${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.error('[pageerror]', err && err.stack ? err.stack : String(err));
    });
    page.on('requestfailed', req => {
      console.warn('[requestfailed]', req.url(), req.failure() && req.failure().errorText);
    });

    console.log('Opening', url);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 }).catch(e=>console.error('goto err', e && e.message));
    // wait a moment for any client-side errors to surface
    await page.waitForTimeout(800);
    await page.screenshot({ path: out, fullPage: true }).catch(e=>console.error('screenshot err', e && e.message));
    console.log('Saved screenshot to', out);
    await browser.close();
  } catch (e) {
    console.error('Playwright script failed:', e && e.message ? e.message : e);
    console.error('If Playwright is not installed, run: npm i -D playwright && npx playwright install --with-deps');
    process.exit(1);
  }
})();
