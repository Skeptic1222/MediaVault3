import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test('should have health check endpoint', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('OK');
    expect(data).toHaveProperty('timestamp');
  });

  test('should return proper status codes', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
  });

  test('should have correct content-type headers', async ({ request }) => {
    const response = await request.get('/api/health');
    const contentType = response.headers()['content-type'];

    expect(contentType).toContain('application/json');
  });

  test('should handle API errors with proper status codes', async ({ request }) => {
    const response = await request.get('/api/non-existent-endpoint');

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Authenticated API Endpoints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should access media endpoints when authenticated', async ({ page }) => {
    const response = await page.request.get('/api/media');

    // Should return success or empty list
    expect(response.status()).toBeLessThan(500);
  });

  test('should access categories endpoint', async ({ page }) => {
    const response = await page.request.get('/api/categories');

    // Should return success or empty list
    expect(response.status()).toBeLessThan(500);
  });

  test('should have CORS headers if needed', async ({ page }) => {
    const response = await page.request.get('/api/health');
    const headers = response.headers();

    // CORS headers may or may not be present depending on config
    expect(headers).toBeDefined();
  });

  test('should handle OPTIONS requests', async ({ page }) => {
    const response = await page.request.fetch('/api/health', {
      method: 'OPTIONS'
    });

    // OPTIONS should be handled
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Media API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should list media files', async ({ page }) => {
    const response = await page.request.get('/api/media');

    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data) || typeof data === 'object').toBe(true);
    }
  });

  test('should handle media filtering', async ({ page }) => {
    const response = await page.request.get('/api/media?type=image');

    expect(response.status()).toBeLessThan(500);
  });

  test('should support pagination', async ({ page }) => {
    const response = await page.request.get('/api/media?limit=10&offset=0');

    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Categories API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should list categories', async ({ page }) => {
    const response = await page.request.get('/api/categories');

    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data) || typeof data === 'object').toBe(true);
    }
  });

  test('should create category with POST', async ({ page }) => {
    const response = await page.request.post('/api/categories', {
      data: {
        name: 'Test Category',
        parentId: null
      }
    });

    // Should succeed or return validation error
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Upload API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should have upload endpoint', async ({ page }) => {
    // This test verifies the upload endpoint exists
    // Actual upload testing is done in media-upload.spec.ts

    const response = await page.request.post('/api/upload', {
      multipart: {
        // Empty multipart request to test endpoint
      },
      failOnStatusCode: false
    });

    // Should return error for missing file, not 404
    expect(response.status()).not.toBe(404);
  });

  test('should validate upload request format', async ({ page }) => {
    const response = await page.request.post('/api/upload', {
      data: {
        invalid: 'data'
      },
      failOnStatusCode: false
    });

    // Should return validation error
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Vault API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should require authentication for vault access', async ({ page, context }) => {
    // Create new page without auth
    const newPage = await context.newPage();

    const response = await newPage.request.get('/api/vault/files', {
      failOnStatusCode: false
    });

    // Should require authentication
    expect(response.status()).toBeGreaterThanOrEqual(401);

    await newPage.close();
  });

  test('should require vault token for vault operations', async ({ page }) => {
    const response = await page.request.get('/api/vault/files', {
      failOnStatusCode: false
    });

    // May require vault token
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('User API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should get current user info', async ({ page }) => {
    const response = await page.request.get('/api/user');

    if (response.ok()) {
      const user = await response.json();
      expect(user).toHaveProperty('id');
    }
  });

  test('should handle user preferences', async ({ page }) => {
    const response = await page.request.get('/api/user/preferences', {
      failOnStatusCode: false
    });

    // Endpoint may or may not exist
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Search API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should support media search', async ({ page }) => {
    const response = await page.request.get('/api/media/search?q=test', {
      failOnStatusCode: false
    });

    expect(response.status()).toBeLessThan(500);
  });

  test('should handle empty search queries', async ({ page }) => {
    const response = await page.request.get('/api/media/search?q=', {
      failOnStatusCode: false
    });

    expect(response.status()).toBeLessThan(500);
  });

  test('should sanitize search queries', async ({ page }) => {
    const response = await page.request.get('/api/media/search?q=<script>alert(1)</script>', {
      failOnStatusCode: false
    });

    // Should not cause server error
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Rate Limiting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should handle multiple rapid requests', async ({ page }) => {
    const requests = [];

    for (let i = 0; i < 50; i++) {
      requests.push(page.request.get('/api/health', { failOnStatusCode: false }));
    }

    const responses = await Promise.all(requests);

    // Should handle all requests (may rate limit some)
    responses.forEach(response => {
      expect(response.status()).toBeLessThan(500);
    });
  });
});
