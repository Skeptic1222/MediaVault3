import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';

test.describe('Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/api/login');
    await page.waitForURL(/.*\/(|home)$/);
  });

  test('should navigate to Gallery page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.navigateToGallery();
    await expect(page).toHaveURL(/.*\/gallery/);
  });

  test('should navigate to Vault page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.navigateToVault();
    await expect(page).toHaveURL(/.*\/vault/);
  });

  test('should navigate to Files page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.navigateToFiles();
    await expect(page).toHaveURL(/.*\/files/);
  });

  test('should navigate to Music page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.navigateToMusic();
    await expect(page).toHaveURL(/.*\/music/);
  });

  test('should navigate to Documents page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.navigateToDocuments();
    await expect(page).toHaveURL(/.*\/documents/);
  });

  test('should navigate to Settings page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.navigateToSettings();
    await expect(page).toHaveURL(/.*\/settings/);
  });

  test('should handle browser back button correctly', async ({ page }) => {
    const homePage = new HomePage(page);

    // Navigate to gallery
    await homePage.navigateToGallery();
    await expect(page).toHaveURL(/.*\/gallery/);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/.*\/(|home)$/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/.*\/gallery/);
  });

  test('should update page title on navigation', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.navigateToGallery();

    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should handle direct URL access', async ({ page }) => {
    // Direct navigation to gallery
    await page.goto('/gallery');
    await expect(page).toHaveURL(/.*\/gallery/);

    // Should be accessible since we're authenticated
    await expect(page.locator('main')).toBeVisible();
  });

  test('should handle 404 for invalid routes', async ({ page }) => {
    await page.goto('/invalid-route-that-does-not-exist');

    // Should show not found page or redirect
    const content = await page.content();
    expect(content.toLowerCase()).toMatch(/not found|404|home/i);
  });
});
