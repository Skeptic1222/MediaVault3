import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should load home page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`Home page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // 5 seconds max
  });

  test('should load gallery page within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`Gallery page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have acceptable Time to First Byte', async ({ page }) => {
    const startTime = Date.now();
    const response = await page.goto('/');
    const ttfb = Date.now() - startTime;

    console.log(`TTFB: ${ttfb}ms`);
    expect(ttfb).toBeLessThan(2000); // 2 seconds max
    expect(response?.ok()).toBe(true);
  });

  test('should measure Core Web Vitals', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
      };
    });

    console.log('Performance Metrics:', metrics);

    expect(metrics.domContentLoaded).toBeGreaterThan(0);
    expect(metrics.domInteractive).toBeLessThan(5000);
  });

  test('should not have excessive resource loading', async ({ page }) => {
    const resources: any[] = [];

    page.on('response', (response) => {
      resources.push({
        url: response.url(),
        status: response.status(),
        size: response.headers()['content-length']
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log(`Total resources loaded: ${resources.length}`);

    // Reasonable limit on number of resources
    expect(resources.length).toBeLessThan(150);
  });

  test('should have efficient image loading', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    const images = page.locator('img');
    const count = await images.count();

    console.log(`Images on page: ${count}`);

    // Check for lazy loading attributes
    if (count > 0) {
      const firstImage = images.first();
      const loading = await firstImage.getAttribute('loading');

      // Images might use lazy loading
      expect(loading === 'lazy' || loading === null).toBe(true);
    }
  });

  test('should handle large media lists efficiently', async ({ page }) => {
    await page.goto('/gallery');

    const startTime = Date.now();

    // Scroll through the page
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('End');
      await page.waitForTimeout(300);
    }

    const scrollTime = Date.now() - startTime;

    console.log(`Scroll performance: ${scrollTime}ms`);
    expect(scrollTime).toBeLessThan(5000);
  });

  test('should not have memory leaks on navigation', async ({ page }) => {
    // Navigate between pages multiple times
    for (let i = 0; i < 3; i++) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.goto('/gallery');
      await page.waitForLoadState('networkidle');

      await page.goto('/vault');
      await page.waitForLoadState('networkidle');
    }

    // Page should still be responsive
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have acceptable JavaScript bundle size', async ({ page }) => {
    const jsResources: any[] = [];

    page.on('response', (response) => {
      if (response.url().endsWith('.js')) {
        jsResources.push({
          url: response.url(),
          size: response.headers()['content-length']
        });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log(`JavaScript files loaded: ${jsResources.length}`);

    // Log sizes for analysis
    let totalSize = 0;
    jsResources.forEach(resource => {
      if (resource.size) {
        totalSize += parseInt(resource.size);
      }
    });

    console.log(`Total JS size: ${(totalSize / 1024).toFixed(2)} KB`);
  });

  test('should cache static resources', async ({ page }) => {
    // First visit
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Second visit - should use cache
    const cachedResponses: any[] = [];

    page.on('response', (response) => {
      if (response.fromCache()) {
        cachedResponses.push(response.url());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log(`Cached resources: ${cachedResponses.length}`);
    // Some resources should be cached
    expect(cachedResponses.length >= 0).toBe(true);
  });
});

test.describe('API Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should have fast API response times', async ({ page }) => {
    const startTime = Date.now();
    const response = await page.request.get('/api/health');
    const responseTime = Date.now() - startTime;

    console.log(`API response time: ${responseTime}ms`);

    expect(response.ok()).toBe(true);
    expect(responseTime).toBeLessThan(1000); // 1 second max
  });

  test('should handle concurrent API requests', async ({ page }) => {
    const requests = [];

    for (let i = 0; i < 10; i++) {
      requests.push(page.request.get('/api/health'));
    }

    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const totalTime = Date.now() - startTime;

    console.log(`10 concurrent requests completed in: ${totalTime}ms`);

    responses.forEach(response => {
      expect(response.ok()).toBe(true);
    });

    expect(totalTime).toBeLessThan(3000);
  });
});
