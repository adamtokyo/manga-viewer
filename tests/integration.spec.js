import { test, expect } from '@playwright/test';

test.describe('Manga Viewer Integration', () => {
  // 120 seconds timeout to allow flipping through all pages
  test.setTimeout(120000);

  test('flip through all pages without getting stuck', async ({ page }) => {
  // Navigate to the local application
  await page.goto('http://127.0.0.1:3000');

  let currentIndex = 0;
  let stuckCount = 0;
  const maxStuckCount = 100; // max ~10 seconds without page change
  
  // Find the top image element which contains the current index
  const imgTopLow = page.locator('#img-top-low');

  while (true) {
    const indexStr = await imgTopLow.getAttribute('data-index');
    if (indexStr !== null) {
      const newIndex = parseInt(indexStr, 10);
      
      if (newIndex > currentIndex) {
        currentIndex = newIndex;
        stuckCount = 0;
      } else if (newIndex === currentIndex) {
        stuckCount++;
        
        // Check if the "no entry" icon is visible, indicating we've reached the end
        const noEntryOpacity = await page.locator('#no-entry').evaluate(el => window.getComputedStyle(el).opacity);
        if (parseFloat(noEntryOpacity) > 0) {
          console.log(`Reached the end at page ${currentIndex}`);
          break;
        }
        
        if (stuckCount > maxStuckCount) {
           throw new Error(`Test got stuck at index ${currentIndex}. Did not progress for too long.`);
        }
      }
    }
    
    // Attempt to go to the next page
    // Using the left 1/3 UI zone flash behavior or ArrowLeft key. ArrowLeft initiates gotoNext()
    await page.keyboard.press('ArrowLeft');
    
    // Wait briefly before next action
    await page.waitForTimeout(100);
  }
  
  // Verify we actually flipped through multiple pages
  expect(currentIndex).toBeGreaterThan(0);
});

  test('chapter skip menu functionality', async ({ page }) => {
    // Navigate to the local application
    await page.goto('http://127.0.0.1:3000');

    // UI is visible on load, click the menu button
    await page.locator('#btn-menu').click();

    // Wait for side menu to slide out
    const sideMenu = page.locator('#side-menu');
    await expect(sideMenu).not.toHaveClass(/-translate-x-full/);

    // Wait for chapters to load and click "Chapter 2"
    const chapterBtn = page.locator('#chapter-list button', { hasText: 'Chapter 2' });
    await chapterBtn.waitFor({ state: 'visible' });
    await chapterBtn.click();

    // Menu should close
    await expect(sideMenu).toHaveClass(/.*-translate-x-full.*/);

    // After animation or fetch, the data-index should update to 13
    await expect(page.locator('#img-top-low')).toHaveAttribute('data-index', '13');
  });

  test('rapid backwards swipe does not get stuck', async ({ page }) => {
    await page.goto('http://127.0.0.1:3000');
    
    // Jump to chapter 2 (index 13) via menu to give us pages to swipe back through
    await page.locator('#btn-menu').click();
    const chapterBtn = page.locator('#chapter-list button', { hasText: 'Chapter 2' });
    await chapterBtn.waitFor({ state: 'visible' });
    await chapterBtn.click();
    await expect(page.locator('#img-top-low')).toHaveAttribute('data-index', '13');

    // Swipe backwards (right-to-left, meaning dx < 0, offset = -1) to index 0 using manual pointer events
    let currentIndex = 13;
    const body = page.locator('body');

    while (currentIndex > 0) {
      // Simulate rapid right-to-left swipe
      const box = await body.boundingBox();
      const startX = box.width * 0.8;
      const endX = box.width * 0.2;
      const startY = box.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Fast move
      await page.mouse.move(endX, startY, { steps: 5 });
      await page.mouse.up();

      currentIndex -= 1;
      
      // Wait for the animation to transition the index naturally
      await expect(page.locator('#img-top-low')).toHaveAttribute('data-index', String(currentIndex), { timeout: 1000 });
      
      // Check that layerTop transform is reset to 0 after animation finishes (no overlapping stuck state)
      const transform = await page.locator('#layer-top').evaluate(el => el.style.transform);
      expect(transform).toBe('translateX(0px)');
    }

    expect(currentIndex).toBe(0);
  });
});
