import { test, expect } from '@playwright/test';

test.describe('Gallery Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3001/mediavault');

    // Wait for authentication to complete (development mode auto-login)
    await page.waitForURL(/.*\/mediavault.*/);

    // Navigate to gallery
    await page.click('a[href="/mediavault/gallery"]');
    await page.waitForURL('**/gallery');
  });

  test('Create folder button should be visible and functional', async ({ page }) => {
    // Check if the create folder button exists
    const createFolderButton = page.getByTestId('create-folder-gallery');
    await expect(createFolderButton).toBeVisible();

    // Click the create folder button
    await createFolderButton.click();

    // Handle the prompt dialog
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      expect(dialog.message()).toContain('Enter folder name');
      await dialog.accept('Test Folder');
    });

    // Trigger the click that will show the prompt
    await createFolderButton.click();

    // Wait for the toast notification
    await expect(page.getByText('Folder created successfully')).toBeVisible({ timeout: 5000 });
  });

  test('Create folder in FileManager should work', async ({ page }) => {
    // Navigate to file manager
    await page.click('a[href="/mediavault/file-manager"]');
    await page.waitForURL('**/file-manager');

    // Check if the create folder button exists
    const createFolderButton = page.getByTestId('button-create-folder');
    await expect(createFolderButton).toBeVisible();

    // Click the create folder button and handle prompt
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('FileManager Test Folder');
    });

    await createFolderButton.click();

    // Wait for success toast
    await expect(page.getByText('Folder created successfully')).toBeVisible({ timeout: 5000 });
  });

  test('Share button should be visible in media lightbox', async ({ page }) => {
    // First, upload a test image to ensure there's media to share
    await page.click('[data-testid="upload-media"]');

    // Wait for import modal
    await expect(page.getByTestId('import-modal')).toBeVisible();

    // Upload a test file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data')
    });

    // Wait for upload to complete
    await expect(page.getByText(/upload.*complete/i)).toBeVisible({ timeout: 10000 });

    // Close the import modal
    await page.click('button:has-text("Close")').catch(() => {});

    // Click on the uploaded media to open lightbox
    const mediaItem = page.locator('[data-testid="media-grid"] > div').first();
    await mediaItem.click();

    // Wait for lightbox to open
    await expect(page.getByTestId('media-lightbox')).toBeVisible();

    // Check if share button is visible
    const shareButton = page.getByTestId('share-button');
    await expect(shareButton).toBeVisible();
  });

  test('Share dialog should open when share button is clicked', async ({ page }) => {
    // Skip if no media available
    const hasMedia = await page.locator('[data-testid="media-grid"] > div').count() > 0;

    if (hasMedia) {
      // Click on media to open lightbox
      await page.locator('[data-testid="media-grid"] > div').first().click();

      // Wait for lightbox
      await expect(page.getByTestId('media-lightbox')).toBeVisible();

      // Click share button
      await page.getByTestId('share-button').click();

      // Check if share dialog opens
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/Share/i)).toBeVisible();
      await expect(page.getByText(/Create.*share.*link/i)).toBeVisible();
    }
  });

  test('Create share link with options', async ({ page }) => {
    const hasMedia = await page.locator('[data-testid="media-grid"] > div').count() > 0;

    if (hasMedia) {
      // Open media lightbox
      await page.locator('[data-testid="media-grid"] > div').first().click();
      await expect(page.getByTestId('media-lightbox')).toBeVisible();

      // Click share button
      await page.getByTestId('share-button').click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Enable password protection
      await page.locator('#use-password').click();
      await page.locator('#password').fill('test123');

      // Set expiration
      await page.locator('#expires').fill('24');

      // Set max uses
      await page.locator('#max-uses').fill('5');

      // Create share link
      await page.click('button:has-text("Create Share Link")');

      // Wait for success
      await expect(page.getByText(/Share link created/i)).toBeVisible({ timeout: 5000 });

      // Check if share URL is displayed
      await expect(page.getByText(/Share Link/i)).toBeVisible();
    }
  });

  test('Copy share link to clipboard', async ({ page }) => {
    const hasMedia = await page.locator('[data-testid="media-grid"] > div').count() > 0;

    if (hasMedia) {
      // Open share dialog
      await page.locator('[data-testid="media-grid"] > div').first().click();
      await page.getByTestId('share-button').click();

      // Create share link (no options)
      await page.click('button:has-text("Create Share Link")');
      await expect(page.getByText(/created/i)).toBeVisible({ timeout: 5000 });

      // Click copy button
      const copyButton = page.locator('button').filter({ has: page.locator('svg') }).last();
      await copyButton.click();

      // Check for copied notification
      await expect(page.getByText(/Copied/i)).toBeVisible();
    }
  });
});
