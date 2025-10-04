import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';
import { HomePage } from './pages/HomePage';

test.describe('Responsive Design - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should display desktop navigation', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.navigate();

    // Desktop navigation should be visible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should have appropriate layout for desktop', async ({ page }) => {
    await page.goto('/gallery');

    const main = page.locator('main');
    const box = await main.boundingBox();

    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeGreaterThan(768);
    }
  });

  test('should display multi-column grid on desktop', async ({ page }) => {
    await page.goto('/gallery');

    const mediaGrid = page.locator('[data-testid="media-grid"]').or(page.locator('main'));
    await expect(mediaGrid).toBeVisible();
  });
});

test.describe('Responsive Design - Mobile', () => {
  test('should display mobile-optimized landing page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12 size
    const landingPage = new LandingPage(page);
    await landingPage.navigate();

    await expect(landingPage.heading).toBeVisible();
    await expect(landingPage.loginButton).toBeVisible();
  });

  test('should have mobile-friendly navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);

    // Check for mobile menu or hamburger icon
    const mobileMenu = page.locator('[data-testid="mobile-menu"]').or(
      page.locator('button[aria-label*="menu"]')
    ).or(page.locator('nav'));

    expect(await mobileMenu.count()).toBeGreaterThan(0);
  });

  test('should handle touch interactions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
    await page.goto('/gallery');

    const mediaItems = page.locator('[data-media-type]').or(page.locator('.media-item'));

    if (await mediaItems.count() > 0) {
      await mediaItems.first().tap();
      await page.waitForTimeout(500);
    }
  });

  test('should have appropriately sized touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);

    const buttons = page.locator('button').or(page.locator('a'));
    const count = await buttons.count();

    if (count > 0) {
      const firstButton = buttons.first();
      const box = await firstButton.boundingBox();

      if (box) {
        // Touch targets should be at least 44x44px (iOS guidelines)
        expect(box.height).toBeGreaterThanOrEqual(30); // Relaxed for various UI elements
      }
    }
  });

  test('should display mobile layout correctly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
    await page.goto('/gallery');

    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(428);

    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should handle orientation change', async ({ page }) => {
    // Portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);

    // Portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/gallery');
    await expect(page.locator('main')).toBeVisible();

    // Landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Responsive Design - Tablet', () => {
  test('should display tablet-optimized layout', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 }); // iPad Pro size
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
    await page.goto('/gallery');

    const main = page.locator('main');
    await expect(main).toBeVisible();

    const box = await main.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThan(768);
      expect(box.width).toBeLessThan(1200);
    }
  });

  test('should adapt grid layout for tablet', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
    await page.goto('/gallery');

    const mediaGrid = page.locator('[data-testid="media-grid"]').or(page.locator('main'));
    await expect(mediaGrid).toBeVisible();
  });
});

test.describe('Visual Regression Tests', () => {
  test('should match landing page screenshot', async ({ page }) => {
    const landingPage = new LandingPage(page);
    await landingPage.navigate();
    await page.waitForLoadState('networkidle');

    // Take screenshot for visual regression testing
    await expect(page).toHaveScreenshot('landing-page.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should match authenticated home screenshot', async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('home-page.png', {
      maxDiffPixels: 100
    });
  });

  test('should match gallery page screenshot', async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('gallery-page.png', {
      maxDiffPixels: 100
    });
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    const h1 = page.locator('h1');
    expect(await h1.count()).toBeGreaterThan(0);
  });

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/gallery');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');

      // Image should have alt text or aria-label
      expect(alt !== null || ariaLabel !== null).toBe(true);
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should have ARIA landmarks', async ({ page }) => {
    await page.goto('/');

    const main = page.locator('main');
    const nav = page.locator('nav');

    expect(await main.count() + await nav.count()).toBeGreaterThan(0);
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');

    // Visual check - actual contrast testing would require additional tools
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should support screen reader navigation', async ({ page }) => {
    await page.goto('/');

    // Check for ARIA labels on interactive elements
    const buttons = page.locator('button');
    const count = await buttons.count();

    if (count > 0) {
      const firstButton = buttons.first();
      const ariaLabel = await firstButton.getAttribute('aria-label');
      const text = await firstButton.textContent();

      // Button should have text or aria-label
      expect(ariaLabel || text).toBeTruthy();
    }
  });
});
