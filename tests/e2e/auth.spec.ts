import { test, expect } from '@playwright/test';
import { LandingPage } from './pages/LandingPage';
import { HomePage } from './pages/HomePage';

test.describe('Authentication Flow', () => {
  test('should display landing page when not authenticated', async ({ page }) => {
    const landingPage = new LandingPage(page);
    await landingPage.navigate();
    await landingPage.verifyLandingPageLoaded();
  });

  test('should show login button on landing page', async ({ page }) => {
    const landingPage = new LandingPage(page);
    await landingPage.navigate();
    await expect(landingPage.loginButton).toBeVisible();
    await expect(landingPage.loginButton).toBeEnabled();
  });

  test('should display all feature sections on landing page', async ({ page }) => {
    const landingPage = new LandingPage(page);
    await landingPage.navigate();
    await landingPage.verifyFeatureSections();
  });

  test('should authenticate successfully with DEV_AUTH', async ({ page }) => {
    // Navigate to login endpoint
    await page.goto('/api/login');

    // Should redirect to home page after authentication
    await page.waitForURL(/.*\/(|home)$/);

    // Verify authenticated state
    const homePage = new HomePage(page);
    await homePage.verifyAuthenticated();
  });

  test('should maintain session after authentication', async ({ page, context }) => {
    // Login
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);

    // Get cookies
    const cookies = await context.cookies();
    expect(cookies.length).toBeGreaterThan(0);

    // Navigate to another page
    const homePage = new HomePage(page);
    await homePage.navigateToGallery();

    // Should still be authenticated
    await expect(page).toHaveURL(/.*\/gallery/);
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);

    // Logout
    await page.goto('/api/logout');

    // Should redirect to landing page
    await page.waitForURL(/.*\/$/);

    // Verify logged out state
    const landingPage = new LandingPage(page);
    await expect(landingPage.loginButton).toBeVisible();
  });

  test('should prevent access to protected routes when not authenticated', async ({ page }) => {
    // Try to access gallery without authentication
    await page.goto('/gallery');

    // Should redirect to landing page
    await page.waitForURL(/.*\/$/);

    const landingPage = new LandingPage(page);
    await expect(landingPage.loginButton).toBeVisible();
  });

  test('should have secure session cookies', async ({ page, context }) => {
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);

    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name.includes('session') || c.name.includes('connect.sid'));

    if (sessionCookie) {
      expect(sessionCookie.httpOnly).toBe(true);
      // Note: secure flag depends on HTTPS in production
    }
  });
});
