import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Home Page Object Model
 * Represents the authenticated home/dashboard page
 */
export class HomePage extends BasePage {
  readonly galleryLink = this.page.getByRole('link', { name: /gallery/i });
  readonly vaultLink = this.page.getByRole('link', { name: /vault/i });
  readonly filesLink = this.page.getByRole('link', { name: /files/i });
  readonly musicLink = this.page.getByRole('link', { name: /music/i });
  readonly documentsLink = this.page.getByRole('link', { name: /documents/i });
  readonly settingsLink = this.page.getByRole('link', { name: /settings/i });

  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.goto('/');
  }

  async verifyAuthenticated() {
    // When authenticated, should see navigation links
    await expect(this.page.locator('main')).toBeVisible();
  }

  async navigateToGallery() {
    await this.galleryLink.click();
    await expect(this.page).toHaveURL(/.*\/gallery/);
  }

  async navigateToVault() {
    await this.vaultLink.click();
    await expect(this.page).toHaveURL(/.*\/vault/);
  }

  async navigateToFiles() {
    await this.filesLink.click();
    await expect(this.page).toHaveURL(/.*\/files/);
  }

  async navigateToMusic() {
    await this.musicLink.click();
    await expect(this.page).toHaveURL(/.*\/music/);
  }

  async navigateToDocuments() {
    await this.documentsLink.click();
    await expect(this.page).toHaveURL(/.*\/documents/);
  }

  async navigateToSettings() {
    await this.settingsLink.click();
    await expect(this.page).toHaveURL(/.*\/settings/);
  }
}
