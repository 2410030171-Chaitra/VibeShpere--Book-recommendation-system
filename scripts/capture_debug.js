// Verbose Playwright capture for debugging blank page
const url = process.argv[2] || 'http://127.0.0.1:5173/'
const out = process.argv[3] || '/tmp/vibesphere_capture_debug.png'

(async ()=>{
  console.log('capture_debug start', { url, out });
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    console.log('browser launched');
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', msg => {
      console.log(`[console:${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.error('[pageerror]', err && err.stack ? err.stack : String(err));
    });
    page.on('requestfailed', req => {
      console.warn('[requestfailed]', req.url(), req.failure() && req.failure().errorText);
    });

    console.log('navigating to', url);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
      .then(()=>console.log('goto succeeded'))
      .catch(e=>console.error('goto error', e && e.stack ? e.stack : e));

    console.log('waiting a bit for client scripts');
    await page.waitForTimeout(1000);

    const html = await page.content();
    console.log('page content length:', html.length);
    console.log('page content snippet:', html.slice(0,800));

    await page.screenshot({ path: out, fullPage: true })
      .then(()=>console.log('screenshot saved', out))
      .catch(e=>console.error('screenshot error', e && e.message));

    await browser.close();
    console.log('browser closed');
    process.exit(0);
  } catch (e) {
    console.error('capture_debug failed', e && e.stack ? e.stack : e);
    process.exit(2);
  }
})();
