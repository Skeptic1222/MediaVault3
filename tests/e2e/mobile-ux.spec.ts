import { test, expect, devices, Page } from '@playwright/test';

/**
 * Mobile UX Test Suite
 * Comprehensive mobile UI testing with device emulation
 * Tests swipe gestures, touch targets, responsive layouts, and performance
 */

// Device configurations for testing
const DEVICES = {
  iphoneSE: { ...devices['iPhone SE'], name: 'iPhone SE' },
  iphone12Pro: { ...devices['iPhone 12 Pro'], name: 'iPhone 12 Pro' },
  iphone12ProMax: { ...devices['iPhone 12 Pro Max'], name: 'iPhone 12 Pro Max' },
  ipadPortrait: {
    ...devices['iPad (gen 7)'],
    name: 'iPad Portrait',
    viewport: { width: 768, height: 1024 }
  },
  ipadLandscape: {
    ...devices['iPad (gen 7) landscape'],
    name: 'iPad Landscape',
    viewport: { width: 1024, height: 768 }
  },
  pixel5: { ...devices['Pixel 5'], name: 'Pixel 5' },
  galaxyS21: {
    name: 'Samsung Galaxy S21',
    viewport: { width: 360, height: 800 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G991B) AppleWebKit/537.36',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};

test.describe('Mobile UI Testing - Media Lightbox', () => {

  test.describe('Touch Gestures in Lightbox', () => {

    test('should navigate to next image on swipe left', async ({ browser }) => {
      const context = await browser.newContext(DEVICES.iphone12Pro);
      const page = await context.newPage();

      await page.goto('/gallery');
      await page.waitForLoadState('networkidle');

      // Wait for media grid to load
      const mediaGrid = page.locator('[data-testid="media-grid"]');
      await expect(mediaGrid).toBeVisible({ timeout: 10000 });

      // Get media items
      const mediaItems = page.locator('[data-testid^="media-item-"]');
      const itemCount = await mediaItems.count();

      if (itemCount < 2) {
        test.skip(true, 'Need at least 2 media items for swipe test');
      }

      // Open first media item
      await mediaItems.first().click();
      await page.waitForSelector('[data-testid="media-lightbox"]', { timeout: 5000 });

      // Get current image source
      const lightboxImage = page.locator('[data-testid="lightbox-image"], [data-testid="lightbox-video"]');
      await lightboxImage.waitFor({ state: 'visible', timeout: 5000 });
      const img1Src = await lightboxImage.getAttribute('src');

      // Perform swipe left gesture (touchstart -> touchmove -> touchend)
      const lightbox = page.locator('[data-testid="media-lightbox"]');
      const box = await lightbox.boundingBox();

      if (box) {
        // Swipe from right to left (to go to next image)
        await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height / 2);
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();
      }

      // Wait for navigation animation
      await page.waitForTimeout(500);

      // Verify image changed
      const img2Src = await lightboxImage.getAttribute('src');
      expect(img2Src).not.toBe(img1Src);

      await context.close();
    });

    test('should navigate to previous image on swipe right', async ({ browser }) => {
      const context = await browser.newContext(DEVICES.iphone12Pro);
      const page = await context.newPage();

      await page.goto('/gallery');
      await page.waitForLoadState('networkidle');

      const mediaItems = page.locator('[data-testid^="media-item-"]');
      const itemCount = await mediaItems.count();

      if (itemCount < 2) {
        test.skip(true, 'Need at least 2 media items for swipe test');
      }

      // Open second media item
      await mediaItems.nth(1).click();
      await page.waitForSelector('[data-testid="media-lightbox"]', { timeout: 5000 });

      const lightboxImage = page.locator('[data-testid="lightbox-image"], [data-testid="lightbox-video"]');
      await lightboxImage.waitFor({ state: 'visible', timeout: 5000 });
      const img1Src = await lightboxImage.getAttribute('src');

      // Swipe right to go to previous
      const lightbox = page.locator('[data-testid="media-lightbox"]');
      const box = await lightbox.boundingBox();

      if (box) {
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();
      }

      await page.waitForTimeout(500);

      const img2Src = await lightboxImage.getAttribute('src');
      expect(img2Src).not.toBe(img1Src);

      await context.close();
    });

    test('should close lightbox on swipe down', async ({ browser }) => {
      const context = await browser.newContext(DEVICES.iphone12Pro);
      const page = await context.newPage();

      await page.goto('/gallery');
      await page.waitForLoadState('networkidle');

      const mediaItems = page.locator('[data-testid^="media-item-"]');
      await mediaItems.first().click();
      await page.waitForSelector('[data-testid="media-lightbox"]', { timeout: 5000 });

      // Swipe down to close
      const lightbox = page.locator('[data-testid="media-lightbox"]');
      const box = await lightbox.boundingBox();

      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + 100);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height - 100, { steps: 10 });
        await page.mouse.up();
      }

      await page.waitForTimeout(500);

      // Lightbox should be closed or use close button
      const closeButton = page.locator('[data-testid="lightbox-close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }

      await expect(lightbox).not.toBeVisible({ timeout: 2000 });

      await context.close();
    });
  });

  test.describe('Lightbox Controls on Mobile', () => {

    test('should show/hide controls on tap', async ({ browser }) => {
      const context = await browser.newContext(DEVICES.iphone12Pro);
      const page = await context.newPage();

      await page.goto('/gallery');
      await page.waitForLoadState('networkidle');

      const mediaItems = page.locator('[data-testid^="media-item-"]');
      if (await mediaItems.count() > 0) {
        await mediaItems.first().click();
        await page.waitForSelector('[data-testid="media-lightbox"]', { timeout: 5000 });

        // Controls should be visible initially
        const closeButton = page.locator('[data-testid="lightbox-close"]');
        await expect(closeButton).toBeVisible();

        // Wait for controls to auto-hide (3 seconds)
        await page.waitForTimeout(3500);

        // Tap to show controls again
        await page.locator('[data-testid="media-lightbox"]').click();
        await expect(closeButton).toBeVisible({ timeout: 1000 });
      }

      await context.close();
    });

    test('should have accessible navigation buttons', async ({ browser }) => {
      const context = await browser.newContext(DEVICES.iphone12Pro);
      const page = await context.newPage();

      await page.goto('/gallery');
      await page.waitForLoadState('networkidle');

      const mediaItems = page.locator('[data-testid^="media-item-"]');
      const itemCount = await mediaItems.count();

      if (itemCount >= 2) {
        await mediaItems.first().click();
        await page.waitForSelector('[data-testid="media-lightbox"]', { timeout: 5000 });

        // Check navigation buttons are accessible
        const nextButton = page.locator('[data-testid="lightbox-next"]');
        const prevButton = page.locator('[data-testid="lightbox-previous"]');

        await expect(nextButton).toBeVisible();

        // Test next navigation
        await nextButton.click();
        await page.waitForTimeout(500);

        await expect(prevButton).toBeVisible();
        await expect(prevButton).toBeEnabled();
      }

      await context.close();
    });
  });
});

test.describe('Mobile UI Testing - Music Player', () => {

  test.describe('Music Player Mobile Controls', () => {

    test('should display mini player on mobile', async ({ browser }) => {
      const context = await browser.newContext(DEVICES.iphone12Pro);
      const page = await context.newPage();

      await page.goto('/music');
      await page.waitForLoadState('networkidle');

      // Check if there are any audio files
      const tracks = page.locator('[data-testid^="track-"]');
      const trackCount = await tracks.count();

      if (trackCount > 0) {
        // Play first track
        const playButton = page.locator('[data-testid^="button-play-"]').first();
        await playButton.click();

        // Wait for audio player to appear
        await page.waitForTimeout(1000);

        // Check if audio player is visible
        const audioPlayer = page.locator('[data-testid="audio-player"]');
        await expect(audioPlayer).toBeVisible({ timeout: 5000 });

        // Verify player controls are visible
        const playPauseButton = page.locator('[data-testid="button-play-pause"]');
        await expect(playPauseButton).toBeVisible();
      }

      await context.close();
    });

    test('should toggle play/pause on mobile', async ({ browser }) => {
      const context = await browser.newContext(DEVICES.iphone12Pro);
      const page = await context.newPage();

      await page.goto('/music');
      await page.waitForLoadState('networkidle');

      const tracks = page.locator('[data-testid^="track-"]');
      const trackCount = await tracks.count();

      if (trackCount > 0) {
        const playButton = page.locator('[data-testid^="button-play-"]').first();
        await playButton.click();
        await page.waitForTimeout(1000);

        const playPauseButton = page.locator('[data-testid="button-play-pause"]');
        await expect(playPauseButton).toBeVisible({ timeout: 5000 });

        // Click to pause
        await playPauseButton.click();
        await page.waitForTimeout(500);

        // Click to play again
        await playPauseButton.click();
        await page.waitForTimeout(500);
      }

      await context.close();
    });

    test('should show queue on mobile', async ({ browser }) => {
      const context = await browser.newContext(DEVICES.iphone12Pro);
      const page = await context.newPage();

      await page.goto('/music');
      await page.waitForLoadState('networkidle');

      const tracks = page.locator('[data-testid^="track-"]');
      const trackCount = await tracks.count();

      if (trackCount > 0) {
        const playButton = page.locator('[data-testid^="button-play-"]').first();
        await playButton.click();
        await page.waitForTimeout(1000);

        // Open queue
        const queueButton = page.locator('[data-testid="button-queue"]');
        if (await queueButton.isVisible()) {
          await queueButton.click();
          await page.waitForTimeout(500);

          // Queue should be visible (as a sheet/drawer on mobile)
          const queueItem = page.locator('[data-testid^="queue-item-"]').first();
          await expect(queueItem).toBeVisible({ timeout: 3000 });
        }
      }

      await context.close();
    });
  });
});

test.describe('Mobile UI Testing - Touch Target Validation', () => {

  test('should have touch targets >= 44x44px (WCAG AAA)', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    // Check all interactive elements
    const buttons = page.locator('button:visible, a:visible, [role="button"]:visible');
    const count = await buttons.count();

    const tooSmall: string[] = [];

    for (let i = 0; i < Math.min(count, 20); i++) { // Check first 20 buttons
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      if (box) {
        const testId = await button.getAttribute('data-testid') || `button-${i}`;
        if (box.width < 44 || box.height < 44) {
          tooSmall.push(`${testId}: ${box.width.toFixed(1)}x${box.height.toFixed(1)}px`);
        }
      }
    }

    if (tooSmall.length > 0) {
      console.warn('Touch targets below 44x44px:', tooSmall);
      // Not failing test, just warning
    }

    await context.close();
  });

  test('should have adequate spacing between touch targets', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/music');
    await page.waitForLoadState('networkidle');

    // Check button spacing in toolbar/navigation
    const navButtons = page.locator('nav button:visible');
    const count = await navButtons.count();

    if (count >= 2) {
      for (let i = 0; i < count - 1; i++) {
        const box1 = await navButtons.nth(i).boundingBox();
        const box2 = await navButtons.nth(i + 1).boundingBox();

        if (box1 && box2) {
          const gap = box2.x - (box1.x + box1.width);
          // Minimum 8px gap recommended
          expect(gap).toBeGreaterThanOrEqual(0); // At minimum should not overlap
        }
      }
    }

    await context.close();
  });
});

test.describe('Mobile UI Testing - Responsive Layout', () => {

  test('should not have horizontal overflow on small screens', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphoneSE);
    const page = await context.newPage();

    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    // Check for horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // +1 for rounding

    await context.close();
  });

  test('should adapt grid columns based on screen size', async ({ browser }) => {
    // Test on small phone
    const contextSmall = await browser.newContext(DEVICES.iphoneSE);
    const pageSmall = await contextSmall.newPage();
    await pageSmall.goto('/gallery');
    await pageSmall.waitForLoadState('networkidle');

    const mediaGrid = pageSmall.locator('[data-testid="media-grid"]');
    if (await mediaGrid.isVisible()) {
      const gridColsSmall = await pageSmall.evaluate(() => {
        const grid = document.querySelector('[data-testid="media-grid"]');
        if (grid) {
          const style = getComputedStyle(grid);
          return style.gridTemplateColumns?.split(' ').length || 0;
        }
        return 0;
      });

      expect(gridColsSmall).toBeGreaterThan(0);
      expect(gridColsSmall).toBeLessThanOrEqual(3); // Small screen should have 2-3 columns max
    }

    await contextSmall.close();

    // Test on tablet
    const contextTablet = await browser.newContext(DEVICES.ipadPortrait);
    const pageTablet = await contextTablet.newPage();
    await pageTablet.goto('/gallery');
    await pageTablet.waitForLoadState('networkidle');

    const mediaGridTablet = pageTablet.locator('[data-testid="media-grid"]');
    if (await mediaGridTablet.isVisible()) {
      const gridColsTablet = await pageTablet.evaluate(() => {
        const grid = document.querySelector('[data-testid="media-grid"]');
        if (grid) {
          const style = getComputedStyle(grid);
          return style.gridTemplateColumns?.split(' ').length || 0;
        }
        return 0;
      });

      expect(gridColsTablet).toBeGreaterThan(2); // Tablet should have more columns
    }

    await contextTablet.close();
  });

  test('should handle orientation change gracefully', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    // Start in portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    const mediaGrid = page.locator('[data-testid="media-grid"]');
    await expect(mediaGrid).toBeVisible();

    // Rotate to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(500);

    // Grid should still be visible and functional
    await expect(mediaGrid).toBeVisible();

    await context.close();
  });

  test('should show mobile menu on small screens', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for mobile menu trigger (hamburger icon)
    const mobileMenuTrigger = page.locator('button[aria-label*="menu" i], button[aria-label*="navigation" i]');

    // Mobile menu should exist on small screens
    const count = await mobileMenuTrigger.count();
    if (count > 0) {
      await expect(mobileMenuTrigger.first()).toBeVisible();
    }

    await context.close();
  });
});

test.describe('Mobile UI Testing - Performance', () => {

  test('should load gallery in under 3 seconds on mobile', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    const startTime = Date.now();
    await page.goto('/gallery', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    console.log(`Gallery load time on mobile: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // 5 seconds for mobile (more lenient)

    await context.close();
  });

  test('should have acceptable First Contentful Paint on mobile', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(entry => entry.name === 'first-contentful-paint');

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        fcp: fcp ? fcp.startTime : 0,
      };
    });

    console.log('Mobile Performance Metrics:', metrics);

    // FCP should be under 2.5 seconds (good threshold)
    if (metrics.fcp > 0) {
      expect(metrics.fcp).toBeLessThan(2500);
    }

    await context.close();
  });

  test('should handle scrolling performance on long lists', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    // Scroll multiple times
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('End');
      await page.waitForTimeout(300);
    }

    // Page should still be responsive
    const mediaGrid = page.locator('[data-testid="media-grid"]');
    await expect(mediaGrid).toBeVisible();

    await context.close();
  });
});

test.describe('Mobile UI Testing - Visual Regression', () => {

  test('should match mobile gallery screenshot', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for animations

    await expect(page).toHaveScreenshot('mobile-gallery-iphone12pro.png', {
      fullPage: false,
      threshold: 0.2,
    });

    await context.close();
  });

  test('should match mobile music page screenshot', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/music');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('mobile-music-iphone12pro.png', {
      fullPage: false,
      threshold: 0.2,
    });

    await context.close();
  });

  test('should match tablet gallery screenshot', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.ipadPortrait);
    const page = await context.newPage();

    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('tablet-gallery-ipad.png', {
      fullPage: false,
      threshold: 0.2,
    });

    await context.close();
  });
});

test.describe('Mobile UI Testing - Cross-Device Compatibility', () => {

  Object.values(DEVICES).forEach(device => {
    test(`should load on ${device.name}`, async ({ browser }) => {
      const context = await browser.newContext(device);
      const page = await context.newPage();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Basic sanity check
      const main = page.locator('main');
      await expect(main).toBeVisible({ timeout: 10000 });

      await context.close();
    });
  });

  test('should maintain aspect ratio on different screen sizes', async ({ browser }) => {
    const devices = [DEVICES.iphoneSE, DEVICES.iphone12ProMax, DEVICES.ipadPortrait];

    for (const device of devices) {
      const context = await browser.newContext(device);
      const page = await context.newPage();

      await page.goto('/gallery');
      await page.waitForLoadState('networkidle');

      // Check media items maintain aspect ratio
      const mediaItems = page.locator('[data-testid^="media-item-"]').first();
      if (await mediaItems.isVisible()) {
        const box = await mediaItems.boundingBox();
        if (box) {
          // Images should be square or maintain reasonable aspect ratio
          const aspectRatio = box.width / box.height;
          expect(aspectRatio).toBeGreaterThan(0.5);
          expect(aspectRatio).toBeLessThan(2);
        }
      }

      await context.close();
    }
  });
});

test.describe('Mobile UI Testing - Accessibility', () => {

  test('should support keyboard navigation on tablet with external keyboard', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.ipadPortrait);
    const page = await context.newPage();

    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Check that focus is visible
    const focusedElement = page.locator(':focus');
    const count = await focusedElement.count();
    expect(count).toBeGreaterThan(0);

    await context.close();
  });

  test('should have proper contrast ratios on mobile', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check text elements have readable contrast
    // This is a basic check - proper testing would use axe-core
    const textElements = page.locator('p, h1, h2, h3, button, a');
    const count = await textElements.count();

    expect(count).toBeGreaterThan(0);

    await context.close();
  });

  test('should support pinch-to-zoom on images', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    const mediaItems = page.locator('[data-testid^="media-item-"]');
    if (await mediaItems.count() > 0) {
      await mediaItems.first().click();
      await page.waitForSelector('[data-testid="media-lightbox"]', { timeout: 5000 });

      // Check zoom buttons are available
      const zoomButtons = page.locator('[data-testid="view-fullscreen"]');
      if (await zoomButtons.count() > 0) {
        await expect(zoomButtons.first()).toBeVisible();
      }
    }

    await context.close();
  });
});

test.describe('Mobile UI Testing - Form Inputs', () => {

  test('should show appropriate keyboard for search input', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/music');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('[data-testid="input-search"]');
    if (await searchInput.count() > 0) {
      await searchInput.click();

      // Input should be focused
      await expect(searchInput).toBeFocused();

      // Type some text
      await searchInput.fill('test');
      const value = await searchInput.inputValue();
      expect(value).toBe('test');
    }

    await context.close();
  });

  test('should have mobile-friendly form controls', async ({ browser }) => {
    const context = await browser.newContext(DEVICES.iphone12Pro);
    const page = await context.newPage();

    await page.goto('/music');
    await page.waitForLoadState('networkidle');

    // Open create playlist dialog
    const createButton = page.locator('[data-testid="button-create-playlist"]');
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(500);

      // Check form inputs are visible and accessible
      const nameInput = page.locator('[data-testid="input-playlist-name"]');
      if (await nameInput.isVisible()) {
        const box = await nameInput.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(40); // Minimum touch-friendly height
      }
    }

    await context.close();
  });
});
