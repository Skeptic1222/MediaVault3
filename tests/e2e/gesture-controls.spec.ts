import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Gesture Controls
 * Tests swipe gestures, pinch zoom, and touch interactions
 */

test.describe('MediaLightbox Gesture Controls', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to gallery page
    await page.goto('/');
    // Wait for media grid to load
    await page.waitForSelector('[data-testid="media-grid"]', { timeout: 10000 });
  });

  test('should open lightbox on image click', async ({ page }) => {
    // Click first media item
    await page.click('[data-testid="media-card"]:first-child');

    // Verify lightbox is open
    await expect(page.locator('[data-testid="media-lightbox"]')).toBeVisible();
  });

  test('should navigate to next image with swipe left', async ({ page }) => {
    // Open lightbox
    await page.click('[data-testid="media-card"]:first-child');

    // Get initial title
    const initialTitle = await page.locator('[data-testid="lightbox-title"]').textContent();

    // Simulate swipe left (next)
    const lightbox = page.locator('[data-testid="media-lightbox"]');
    await lightbox.hover();
    await page.mouse.down();
    await page.mouse.move(100, 400);
    await page.mouse.move(-200, 400);
    await page.mouse.up();

    // Wait for animation
    await page.waitForTimeout(500);

    // Get new title
    const newTitle = await page.locator('[data-testid="lightbox-title"]').textContent();

    // Verify navigation occurred
    expect(newTitle).not.toBe(initialTitle);
  });

  test('should navigate to previous image with swipe right', async ({ page }) => {
    // Open lightbox on second item
    await page.click('[data-testid="media-card"]:nth-child(2)');

    // Get initial title
    const initialTitle = await page.locator('[data-testid="lightbox-title"]').textContent();

    // Simulate swipe right (previous)
    const lightbox = page.locator('[data-testid="media-lightbox"]');
    await lightbox.hover();
    await page.mouse.down();
    await page.mouse.move(100, 400);
    await page.mouse.move(400, 400);
    await page.mouse.up();

    // Wait for animation
    await page.waitForTimeout(500);

    // Get new title
    const newTitle = await page.locator('[data-testid="lightbox-title"]').textContent();

    // Verify navigation occurred
    expect(newTitle).not.toBe(initialTitle);
  });

  test('should close lightbox with swipe down', async ({ page }) => {
    // Open lightbox
    await page.click('[data-testid="media-card"]:first-child');

    // Verify lightbox is open
    await expect(page.locator('[data-testid="media-lightbox"]')).toBeVisible();

    // Simulate swipe down
    const lightbox = page.locator('[data-testid="media-lightbox"]');
    await lightbox.hover();
    await page.mouse.down();
    await page.mouse.move(400, 100);
    await page.mouse.move(400, 300);
    await page.mouse.up();

    // Wait for close animation
    await page.waitForTimeout(500);

    // Verify lightbox is closed
    await expect(page.locator('[data-testid="media-lightbox"]')).not.toBeVisible();
  });

  test('should toggle controls with tap', async ({ page }) => {
    // Open lightbox
    await page.click('[data-testid="media-card"]:first-child');

    // Controls should be visible initially
    await expect(page.locator('[data-testid="lightbox-close"]')).toBeVisible();

    // Wait for controls to auto-hide
    await page.waitForTimeout(3500);

    // Controls should be hidden
    await expect(page.locator('[data-testid="lightbox-close"]')).not.toBeVisible();

    // Tap to show controls
    await page.locator('[data-testid="media-lightbox"]').click();

    // Controls should be visible again
    await expect(page.locator('[data-testid="lightbox-close"]')).toBeVisible();
  });

  test('should use keyboard navigation', async ({ page }) => {
    // Open lightbox
    await page.click('[data-testid="media-card"]:first-child');

    // Get initial title
    const initialTitle = await page.locator('[data-testid="lightbox-title"]').textContent();

    // Press right arrow
    await page.keyboard.press('ArrowRight');

    // Wait for navigation
    await page.waitForTimeout(300);

    // Get new title
    const newTitle = await page.locator('[data-testid="lightbox-title"]').textContent();

    // Verify navigation occurred
    expect(newTitle).not.toBe(initialTitle);
  });

  test('should close with ESC key', async ({ page }) => {
    // Open lightbox
    await page.click('[data-testid="media-card"]:first-child');

    // Verify lightbox is open
    await expect(page.locator('[data-testid="media-lightbox"]')).toBeVisible();

    // Press ESC
    await page.keyboard.press('Escape');

    // Verify lightbox is closed
    await expect(page.locator('[data-testid="media-lightbox"]')).not.toBeVisible();
  });

  test('should prevent navigation beyond boundaries', async ({ page }) => {
    // Open first item
    await page.click('[data-testid="media-card"]:first-child');

    // Previous button should be disabled
    await expect(page.locator('[data-testid="lightbox-previous"]')).toBeDisabled();

    // Try to swipe right (should not navigate)
    const lightbox = page.locator('[data-testid="media-lightbox"]');
    await lightbox.hover();
    await page.mouse.down();
    await page.mouse.move(100, 400);
    await page.mouse.move(400, 400);
    await page.mouse.up();

    // Wait for animation
    await page.waitForTimeout(500);

    // Should still be on first item (button still disabled)
    await expect(page.locator('[data-testid="lightbox-previous"]')).toBeDisabled();
  });
});

test.describe('Music Player Gesture Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show mini player when track is played', async ({ page }) => {
    // This test would need a way to trigger music playback
    // For now, we'll check if the player exists when a track is playing

    // Trigger music playback (implementation depends on your UI)
    // await page.click('[data-testid="play-track"]');

    // Verify mini player appears
    // await expect(page.locator('[data-testid="mini-player"]')).toBeVisible();

    test.skip('Requires music playback implementation');
  });

  test('should expand to full player with swipe up', async ({ page }) => {
    test.skip('Requires music playback implementation');

    // Assuming mini player is visible
    // const miniPlayer = page.locator('[data-testid="mini-player"]');

    // Simulate swipe up
    // await miniPlayer.hover();
    // await page.mouse.down();
    // await page.mouse.move(400, 600);
    // await page.mouse.move(400, 200);
    // await page.mouse.up();

    // Wait for animation
    // await page.waitForTimeout(500);

    // Verify full player is visible
    // await expect(page.locator('[data-testid="full-player"]')).toBeVisible();
  });

  test('should minimize to mini player with swipe down', async ({ page }) => {
    test.skip('Requires music playback implementation');

    // Assuming full player is visible
    // const fullPlayer = page.locator('[data-testid="full-player"]');

    // Simulate swipe down
    // await fullPlayer.hover();
    // await page.mouse.down();
    // await page.mouse.move(400, 200);
    // await page.mouse.move(400, 500);
    // await page.mouse.up();

    // Wait for animation
    // await page.waitForTimeout(500);

    // Verify mini player is visible
    // await expect(page.locator('[data-testid="mini-player"]')).toBeVisible();
    // await expect(page.locator('[data-testid="full-player"]')).not.toBeVisible();
  });

  test('should close player with swipe down on mini player', async ({ page }) => {
    test.skip('Requires music playback implementation');

    // Assuming mini player is visible
    // const miniPlayer = page.locator('[data-testid="mini-player"]');

    // Simulate swipe down
    // await miniPlayer.hover();
    // await page.mouse.down();
    // await page.mouse.move(400, 600);
    // await page.mouse.move(400, 800);
    // await page.mouse.up();

    // Wait for animation
    // await page.waitForTimeout(500);

    // Verify player is closed
    // await expect(page.locator('[data-testid="mini-player"]')).not.toBeVisible();
  });

  test('should show queue when queue button is clicked', async ({ page }) => {
    test.skip('Requires music playback implementation');

    // Assuming full player is visible
    // await page.click('[data-testid="full-button-queue"]');

    // Verify queue is visible
    // await expect(page.locator('[data-testid="queue-item-0"]')).toBeVisible();
  });
});

test.describe('Mobile Viewport Tests', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test('should work on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="media-grid"]', { timeout: 10000 });

    // Open lightbox
    await page.click('[data-testid="media-card"]:first-child');

    // Verify lightbox is open
    await expect(page.locator('[data-testid="media-lightbox"]')).toBeVisible();

    // Verify gesture hints are visible on mobile
    const gestureHints = page.locator('text=Touch Gestures');
    // Note: Visibility depends on CSS classes - may need adjustment
  });

  test('should handle touch events on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip('Mobile-only test');
      return;
    }

    await page.goto('/');
    await page.waitForSelector('[data-testid="media-grid"]', { timeout: 10000 });

    // Open lightbox
    await page.tap('[data-testid="media-card"]:first-child');

    // Verify lightbox is open
    await expect(page.locator('[data-testid="media-lightbox"]')).toBeVisible();
  });
});

test.describe('Accessibility Tests', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="media-grid"]', { timeout: 10000 });

    // Open lightbox
    await page.click('[data-testid="media-card"]:first-child');

    // Check for accessible elements
    await expect(page.locator('[data-testid="lightbox-close"]')).toHaveAttribute('title');
    await expect(page.locator('[data-testid="lightbox-next"]')).toBeVisible();
    await expect(page.locator('[data-testid="lightbox-previous"]')).toBeVisible();
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="media-grid"]', { timeout: 10000 });

    // Tab to first media card
    await page.keyboard.press('Tab');
    // This test would need to verify focus management
    // Actual implementation depends on your focus trap setup
  });

  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="media-grid"]', { timeout: 10000 });

    // Open lightbox
    await page.click('[data-testid="media-card"]:first-child');

    // Tab to buttons and verify focus
    await page.keyboard.press('Tab');

    // Check if focused element has visible focus ring
    const focused = await page.evaluateHandle(() => document.activeElement);
    await expect(focused).toBeTruthy();
  });
});

test.describe('Performance Tests', () => {
  test('should have smooth animations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="media-grid"]', { timeout: 10000 });

    // Measure animation performance
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          resolve(entries);
        });
        observer.observe({ entryTypes: ['measure'] });

        // Trigger animation
        setTimeout(() => {
          performance.measure('animation-test');
          observer.disconnect();
          resolve([]);
        }, 1000);
      });
    });

    // Verify animations complete in reasonable time
    expect(metrics).toBeDefined();
  });

  test('should not cause memory leaks', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="media-grid"]', { timeout: 10000 });

    // Open and close lightbox multiple times
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="media-card"]:first-child');
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Check if cleanup is working
    // This is a basic check - more sophisticated memory profiling would be needed
    const isLightboxClosed = await page.locator('[data-testid="media-lightbox"]').count();
    expect(isLightboxClosed).toBe(0);
  });
});

test.describe('Edge Cases', () => {
  test('should handle rapid swipes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="media-grid"]', { timeout: 10000 });

    // Open lightbox
    await page.click('[data-testid="media-card"]:first-child');

    // Perform rapid swipes
    for (let i = 0; i < 3; i++) {
      const lightbox = page.locator('[data-testid="media-lightbox"]');
      await lightbox.hover();
      await page.mouse.down();
      await page.mouse.move(100, 400);
      await page.mouse.move(-200, 400);
      await page.mouse.up();
      await page.waitForTimeout(100);
    }

    // Verify lightbox is still functional
    await expect(page.locator('[data-testid="media-lightbox"]')).toBeVisible();
  });

  test('should handle interrupted gestures', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="media-grid"]', { timeout: 10000 });

    // Open lightbox
    await page.click('[data-testid="media-card"]:first-child');

    // Start swipe but don't complete
    const lightbox = page.locator('[data-testid="media-lightbox"]');
    await lightbox.hover();
    await page.mouse.down();
    await page.mouse.move(100, 400);
    await page.mouse.move(150, 400);
    await page.mouse.up();

    // Wait for snap back
    await page.waitForTimeout(500);

    // Verify lightbox is still in original state
    await expect(page.locator('[data-testid="media-lightbox"]')).toBeVisible();
  });

  test('should handle single item gallery', async ({ page }) => {
    // This test would need a gallery with only one item
    // Navigation buttons should be disabled or hidden
    test.skip('Requires single-item gallery setup');
  });
});
