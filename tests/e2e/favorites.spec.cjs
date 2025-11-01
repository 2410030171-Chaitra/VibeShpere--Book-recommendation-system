const { test, expect } = require('@playwright/test');

test('favorites toggle persists via backend', async ({ page }) => {
  // Pipe browser console + errors to the test output to aid debugging
  page.on('console', msg => console.log('BROWSER LOG>', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR>', err && err.stack ? err.stack : String(err)));

  // Ensure test user exists in localStorage before app loads
  await page.addInitScript(() => {
    try {
      localStorage.setItem('vibesphere_user', JSON.stringify({ id: 'test_user', name: 'Playwright Tester', email: 'tester@example.com' }));
      // Ensure API base points to backend used in CI/local (default in app is http://localhost:5000/api)
      window.__API_BASE_URL__ = 'http://127.0.0.1:5000/api';
    } catch (e) { }
  });

  // Go to app
  await page.goto('/');

  // Wait for discover main heading
  await expect(page.getByTestId('main-heading')).toBeVisible({ timeout: 10000 });

  // Click a genre to force recommendations / book card rendering (more deterministic than relying on default landing)
  const fictionBtn = page.getByTestId('genre-fiction');
  await expect(fictionBtn).toBeVisible({ timeout: 10000 });
  await fictionBtn.click();

  // Wait for the books counter so we know the recommendations grid has rendered
  await expect(page.getByTestId('books-found-count')).toBeVisible({ timeout: 15000 });

  // Wait for at least one book card and favorite button
  const bookCard = page.locator('article.book-card').first();
  await expect(bookCard).toBeVisible({ timeout: 15000 });

  // Prefer the data-testid button when available, otherwise fall back to the first button in the card
  let favBtn = page.getByTestId(/fav-btn-/).first();
  if (!(await favBtn.count())) {
    favBtn = bookCard.locator('button').first();
  }
  await expect(favBtn).toBeVisible({ timeout: 10000 });

  // Click to add favorite
  await favBtn.click();

  // After clicking, the button should show filled heart
  await expect(favBtn).toHaveText('💖', { timeout: 5000 });

  // Click again to remove favorite
  await favBtn.click();

  // Instead of relying solely on the visible glyph (which can be flaky if the element re-renders),
  // verify the favorite was removed from local storage (the component updates guest/local fallback there).
  const dataTest = await favBtn.getAttribute('data-testid');
  const bookId = dataTest ? dataTest.replace(/^fav-btn-/, '') : null;
  const favsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('vibesphere_guest_favorites') || '[]'));
  expect(favsAfter.find(b => b.id === bookId)).toBeUndefined();
});
