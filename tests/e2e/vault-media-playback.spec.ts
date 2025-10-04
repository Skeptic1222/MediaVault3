import { test, expect } from '@playwright/test';

test.describe('Vault Media Playback', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the vault page
    await page.goto('http://localhost/mediavault/vault');
    await page.waitForLoadState('networkidle');
  });

  test('should open and play vault media after unlocking', async ({ page }) => {
    // Check if vault is locked
    const unlockButton = page.getByTestId('button-unlock-vault');
    if (await unlockButton.isVisible()) {
      // Unlock the vault
      await unlockButton.click();

      // Wait for modal to appear
      await page.waitForSelector('[data-testid="vault-access-modal"]', { state: 'visible' });

      // Enter passphrase (assuming default test passphrase)
      const passphraseInput = page.locator('input[type="password"]');
      await passphraseInput.fill('testpassphrase123');

      // Submit
      const submitButton = page.locator('button:has-text("Unlock Vault")');
      await submitButton.click();

      // Wait for vault to unlock
      await page.waitForSelector('[data-testid="vault-content"]', { state: 'visible', timeout: 10000 });
    }

    // Wait for media grid to load
    await page.waitForSelector('[data-testid="vault-media-grid"]', { state: 'visible', timeout: 10000 });

    // Find first media item
    const firstMediaItem = page.locator('[data-testid="vault-media-grid"] [data-testid^="media-item-"]').first();

    if (await firstMediaItem.isVisible()) {
      // Click to open lightbox
      await firstMediaItem.click();

      // Wait for lightbox to open
      await page.waitForSelector('[data-testid="media-lightbox"]', { state: 'visible', timeout: 5000 });

      // Verify lightbox is visible
      const lightbox = page.getByTestId('media-lightbox');
      await expect(lightbox).toBeVisible();

      // Check if media title is displayed
      const mediaTitle = page.getByTestId('lightbox-title');
      await expect(mediaTitle).toBeVisible();

      // Check if media metadata is displayed
      const mediaMeta = page.getByTestId('lightbox-meta');
      await expect(mediaMeta).toBeVisible();

      // Wait for media to load (check for video or image element)
      const videoOrImage = page.locator('video, img[src*="/api/media/"]').first();
      await expect(videoOrImage).toBeVisible({ timeout: 10000 });

      // Close lightbox with escape key
      await page.keyboard.press('Escape');

      // Verify lightbox closed
      await expect(lightbox).not.toBeVisible();

      console.log('✅ Vault media playback test passed');
    } else {
      console.log('⚠️ No vault media items found to test');
    }
  });

  test('should hide vault stats when locked', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('http://localhost/mediavault/');
    await page.waitForLoadState('networkidle');

    // Check vault items count
    const vaultItemsCard = page.getByTestId('card-vault-items');

    if (await vaultItemsCard.isVisible()) {
      const vaultCountText = await page.getByTestId('text-vault-items-count').textContent();
      const vaultCount = parseInt(vaultCountText?.replace(/,/g, '') || '0');

      console.log(`Vault items count when locked: ${vaultCount}`);

      // When vault is locked, count should be 0
      expect(vaultCount).toBe(0);

      console.log('✅ Vault stats hiding test passed');
    }
  });

  test('should navigate between vault media items', async ({ page }) => {
    // Unlock vault first
    const unlockButton = page.getByTestId('button-unlock-vault');
    if (await unlockButton.isVisible()) {
      await unlockButton.click();
      await page.waitForSelector('[data-testid="vault-access-modal"]', { state: 'visible' });
      const passphraseInput = page.locator('input[type="password"]');
      await passphraseInput.fill('testpassphrase123');
      const submitButton = page.locator('button:has-text("Unlock Vault")');
      await submitButton.click();
      await page.waitForSelector('[data-testid="vault-content"]', { state: 'visible', timeout: 10000 });
    }

    // Wait for media grid
    await page.waitForSelector('[data-testid="vault-media-grid"]', { state: 'visible', timeout: 10000 });

    // Get media item count
    const mediaItems = page.locator('[data-testid="vault-media-grid"] [data-testid^="media-item-"]');
    const itemCount = await mediaItems.count();

    if (itemCount > 1) {
      // Open first item
      await mediaItems.first().click();
      await page.waitForSelector('[data-testid="media-lightbox"]', { state: 'visible', timeout: 5000 });

      // Get first item title
      const firstTitle = await page.getByTestId('lightbox-title').textContent();

      // Navigate to next item using arrow key
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(1000);

      // Get second item title
      const secondTitle = await page.getByTestId('lightbox-title').textContent();

      // Titles should be different
      expect(firstTitle).not.toBe(secondTitle);

      // Navigate back using arrow key
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(1000);

      // Should be back to first item
      const backToFirstTitle = await page.getByTestId('lightbox-title').textContent();
      expect(backToFirstTitle).toBe(firstTitle);

      console.log('✅ Vault media navigation test passed');
    } else {
      console.log('⚠️ Need at least 2 vault items to test navigation');
    }
  });
});
