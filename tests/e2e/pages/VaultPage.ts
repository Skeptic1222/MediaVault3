import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Vault Page Object Model
 * Represents the encrypted vault page with passphrase protection
 */
export class VaultPage extends BasePage {
  readonly passphraseInput: Locator;
  readonly unlockButton: Locator;
  readonly uploadInput: Locator;

  constructor(page: Page) {
    super(page);
    this.passphraseInput = this.page.locator('input[type="password"]');
    this.unlockButton = this.page.getByRole('button', { name: /unlock/i });
    this.uploadInput = this.page.locator('input[type="file"]');
  }

  async navigate() {
    await this.goto('/vault');
  }

  async unlockVault(passphrase: string) {
    await this.passphraseInput.fill(passphrase);
    await this.unlockButton.click();
    // Wait for vault to unlock
    await this.page.waitForTimeout(1000);
  }

  async verifyVaultUnlocked() {
    // Check that passphrase input is no longer visible
    await expect(this.passphraseInput).not.toBeVisible({ timeout: 5000 });
  }

  async uploadEncryptedFile(filePath: string) {
    await this.uploadInput.setInputFiles(filePath);
  }

  async verifyFileEncrypted(fileName: string) {
    await expect(this.page.getByText(fileName)).toBeVisible();
  }
}
