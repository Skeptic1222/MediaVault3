import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Gallery Page Object Model
 * Represents the media gallery page with upload and viewing functionality
 */
export class GalleryPage extends BasePage {
  readonly uploadInput: Locator;
  readonly mediaGrid: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.uploadInput = this.page.locator('input[type="file"]');
    this.mediaGrid = this.page.locator('[data-testid="media-grid"]').or(this.page.locator('.media-grid')).or(this.page.locator('main'));
    this.searchInput = this.page.locator('[data-testid="search-input"]').or(this.page.locator('input[type="search"]'));
  }

  async navigate() {
    await this.goto('/gallery');
  }

  async verifyGalleryLoaded() {
    await expect(this.mediaGrid).toBeVisible();
  }

  async uploadFile(filePath: string) {
    await this.uploadInput.setInputFiles(filePath);
  }

  async uploadMultipleFiles(filePaths: string[]) {
    await this.uploadInput.setInputFiles(filePaths);
  }

  async verifyUploadSuccess() {
    // Wait for success toast or notification
    await expect(
      this.page.locator('text=upload').or(this.page.locator('text=success'))
    ).toBeVisible({ timeout: 15000 });
  }

  async searchMedia(query: string) {
    if (await this.searchInput.count() > 0) {
      await this.searchInput.fill(query);
      await this.searchInput.press('Enter');
    }
  }

  async getMediaItemCount() {
    const items = this.page.locator('[data-media-type]').or(this.page.locator('.media-item'));
    return await items.count();
  }

  async clickMediaItem(index: number = 0) {
    const items = this.page.locator('[data-media-type]').or(this.page.locator('.media-item'));
    await items.nth(index).click();
  }

  async deleteMediaItem(index: number = 0) {
    const items = this.page.locator('[data-media-type]').or(this.page.locator('.media-item'));
    await items.nth(index).hover();
    await this.page.locator('[data-testid="delete-button"]').or(this.page.getByRole('button', { name: /delete/i })).first().click();

    // Confirm deletion
    await this.page.getByRole('button', { name: /confirm/i }).or(this.page.getByRole('button', { name: /delete/i })).click();
  }
}
