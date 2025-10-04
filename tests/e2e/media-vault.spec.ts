import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.describe('MediaVault Application', () => {
  test.describe('Core Functionality', () => {
    test('should load the main application', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/MediaVault/i);
      await expect(page.locator('main')).toBeVisible();
    });

    test('should check health endpoint', async ({ request }) => {
      const response = await request.get('/health');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('status');
    });

    test('should navigate to gallery', async ({ page }) => {
      await page.goto('/');
      await page.click('text=Gallery');
      await expect(page.url()).toContain('/gallery');
      await expect(page.locator('[data-testid="media-grid"]')).toBeVisible();
    });
  });

  test.describe('File Upload', () => {
    test('should upload a media file', async ({ page }) => {
      await page.goto('/');

      // Navigate to upload area
      const uploadInput = page.locator('input[type="file"]');
      await expect(uploadInput).toBeVisible();

      // Create test file path
      const testFile = path.join(__dirname, '../fixtures/test-image.jpg');

      // Upload file
      await uploadInput.setInputFiles(testFile);

      // Verify upload success
      await expect(page.locator('text=Upload successful')).toBeVisible({ timeout: 10000 });
    });

    test('should validate file types', async ({ page }) => {
      await page.goto('/');
      const uploadInput = page.locator('input[type="file"]');

      // Try uploading invalid file type
      const invalidFile = path.join(__dirname, '../fixtures/test.exe');
      await uploadInput.setInputFiles(invalidFile);

      // Should show error
      await expect(page.locator('text=Invalid file type')).toBeVisible();
    });
  });

  test.describe('Media Playback', () => {
    test('should play audio file', async ({ page }) => {
      await page.goto('/gallery');

      // Click on audio file
      await page.click('[data-media-type="audio"]');

      // Check audio player appears
      const audioPlayer = page.locator('audio');
      await expect(audioPlayer).toBeVisible();

      // Test play/pause
      await page.click('[data-testid="play-button"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="pause-button"]');
    });

    test('should play video file', async ({ page }) => {
      await page.goto('/gallery');

      // Click on video file
      await page.click('[data-media-type="video"]');

      // Check video player appears
      const videoPlayer = page.locator('video');
      await expect(videoPlayer).toBeVisible();
    });
  });

  test.describe('Security', () => {
    test('should require authentication when enabled', async ({ page }) => {
      // Skip if AUTH_DISABLED is true
      const response = await page.goto('/api/auth/status');
      const authStatus = await response?.json();

      if (!authStatus?.authDisabled) {
        await page.goto('/vault');
        await expect(page).toHaveURL(/login|auth/);
      }
    });

    test('should sanitize user input', async ({ page }) => {
      await page.goto('/');

      // Try XSS attack in search
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('<script>alert("XSS")</script>');
      await searchInput.press('Enter');

      // Should not execute script
      const alertDialog = page.locator('dialog');
      await expect(alertDialog).not.toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Check mobile menu
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      await expect(mobileMenu).toBeVisible();

      // Check responsive layout
      const mainContent = page.locator('main');
      const box = await mainContent.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(375);
    });

    test('should work on tablet devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(5000); // 5 seconds max
    });

    test('should handle large media lists', async ({ page }) => {
      await page.goto('/gallery');

      // Scroll to load more items
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('End');
        await page.waitForTimeout(500);
      }

      // Check performance metrics
      const metrics = await page.evaluate(() => performance.getEntriesByType('navigation'));
      expect(metrics[0].loadEventEnd).toBeLessThan(10000);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/');

      // Check for ARIA labels
      const buttons = page.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();

        expect(ariaLabel || text).toBeTruthy();
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/');

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Check focus is visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});

test.describe('Visual Regression', () => {
  test('homepage screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('homepage.png', { fullPage: true });
  });

  test('gallery screenshot', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('gallery.png');
  });

  test('dark mode screenshot', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('dark-mode.png');
  });
});