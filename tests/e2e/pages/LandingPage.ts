import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Landing Page Object Model
 * Represents the unauthenticated landing page
 */
export class LandingPage extends BasePage {
  readonly loginButton = this.page.getByTestId('button-login');
  readonly ctaLoginButton = this.page.getByTestId('button-cta-login');
  readonly heading = this.page.getByRole('heading', { name: /SecureGallery Pro/i });

  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.goto('/');
  }

  async verifyLandingPageLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.loginButton).toBeVisible();
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  async verifyFeatureSections() {
    await expect(this.page.getByText('Enterprise Security')).toBeVisible();
    await expect(this.page.getByText('Multi-Database Support')).toBeVisible();
    await expect(this.page.getByText('Encrypted Vault')).toBeVisible();
    await expect(this.page.getByText('Smart Import System')).toBeVisible();
    await expect(this.page.getByText('Advanced Categorization')).toBeVisible();
  }
}
