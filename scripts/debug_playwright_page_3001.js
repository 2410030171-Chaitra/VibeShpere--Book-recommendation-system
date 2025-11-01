const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    const url = 'http://127.0.0.1:3001/';
    console.log('Navigating to', url);
    await page.goto(url, { waitUntil: 'networkidle' });
    const html = await page.content();
    console.log('--- PAGE HTML START ---');
    console.log(html.slice(0, 10000));
    console.log('--- PAGE HTML END ---');
    await page.screenshot({ path: 'scripts/debug_page.png', fullPage: true });
    console.log('Saved screenshot to scripts/debug_page.png');
  } catch (e) {
    console.error('Error during debug run:', e);
  } finally {
    await browser.close();
  }
})();
