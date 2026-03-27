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
});
