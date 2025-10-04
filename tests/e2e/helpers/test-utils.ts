import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Test Utilities and Helper Functions
 */

/**
 * Login helper for authenticated tests
 */
export async function login(page: Page) {
  await page.goto('/api/login');
  await page.waitForURL(/.*\/(|home)$/);
}

/**
 * Logout helper
 */
export async function logout(page: Page) {
  await page.goto('/api/logout');
  await page.waitForURL(/.*\/$/);
}

/**
 * Create test image file
 */
export function createTestImage(filename: string = 'test-image.jpg'): string {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const filePath = path.join(fixturesDir, filename);

  if (!fs.existsSync(filePath)) {
    // Create minimal valid JPEG (1x1 pixel)
    const jpegData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
    ]);
    fs.writeFileSync(filePath, jpegData);
  }

  return filePath;
}

/**
 * Create test text file
 */
export function createTestTextFile(filename: string = 'test-document.txt', content: string = 'Test content'): string {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const filePath = path.join(fixturesDir, filename);
  fs.writeFileSync(filePath, content);

  return filePath;
}

/**
 * Wait for toast/notification message
 */
export async function waitForToast(page: Page, message: string, timeout: number = 5000) {
  await page.waitForSelector(`text=${message}`, { timeout });
}

/**
 * Take screenshot with timestamp
 */
export async function takeTimestampedScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(process.cwd(), 'test-results', 'screenshots', `${name}-${timestamp}.png`);

  const dir = path.dirname(screenshotPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Get all console messages
 */
export async function captureConsoleLogs(page: Page): Promise<{ type: string; text: string }[]> {
  const logs: { type: string; text: string }[] = [];

  page.on('console', (msg) => {
    logs.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  return logs;
}

/**
 * Get all network requests
 */
export async function captureNetworkRequests(page: Page): Promise<{ url: string; method: string; status?: number }[]> {
  const requests: { url: string; method: string; status?: number }[] = [];

  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
    });
  });

  page.on('response', (response) => {
    const request = requests.find(r => r.url === response.url());
    if (request) {
      request.status = response.status();
    }
  });

  return requests;
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  });
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Generate random string
 */
export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Clean up test fixtures
 */
export function cleanupFixtures() {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
  const testFiles = ['test-upload.jpg', 'test-document.txt'];

  testFiles.forEach(file => {
    const filePath = path.join(fixturesDir, file);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.warn(`Failed to delete ${filePath}:`, error);
      }
    }
  });
}
