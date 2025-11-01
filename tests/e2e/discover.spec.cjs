const { test, expect } = require('@playwright/test');

test('discover page shows recommendations after selecting a genre', async ({ page }) => {
  // Pipe browser console + errors to the test output to aid debugging
  page.on('console', msg => console.log('BROWSER LOG>', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR>', err && err.stack ? err.stack : String(err)));

  // Simulate a logged-in user by setting localStorage before the page loads
  await page.addInitScript(() => {
    try {
      localStorage.setItem('vibesphere_user', JSON.stringify({ id: 'test_user', name: 'Playwright Tester', email: 'tester@example.com' }));
    } catch (e) {
      // ignore
    }
  });

  // Navigate to the app (served at baseURL from config)
  await page.goto('/');

  // Check the main heading is present using a stable test id
  try {
    await expect(page.getByTestId('main-heading')).toBeVisible({ timeout: 10000 });
  } catch (err) {
    console.log('--- Dumping page HTML for debugging ---');
    const html = await page.content();
    console.log(html.slice(0, 2000));
    throw err;
  }

  // Wait for genre button to be present and click the Fiction genre using test id
  const fictionBtn = page.getByTestId('genre-fiction');
  await expect(fictionBtn).toBeVisible({ timeout: 10000 });
  await fictionBtn.click();

  // After selecting a genre, the Recommendations section should appear and books count should be visible
  await expect(page.getByTestId('books-found-count')).toBeVisible({ timeout: 15000 });

  // Ensure the books found counter renders and matches the expected pattern
  const countText = await page.getByTestId('books-found-count').textContent();
  expect(countText).toMatch(/^[0-9]+ books? found$/);
});
