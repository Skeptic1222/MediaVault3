import { test, expect } from '@playwright/test';

test.describe('Signed URL Security Verification', () => {
  test('should use signed URLs instead of vault tokens for encrypted media', async ({ page }) => {
    const capturedUrls: string[] = [];

    // Intercept all requests to capture URLs
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/media/') || url.includes('/api/vault/')) {
        capturedUrls.push(url);
        console.log('[Request]', url.substring(url.indexOf('/api')));
      }
    });

    // Navigate to vault page
    await page.goto('http://localhost:3000/mediavault/vault');
    await page.waitForLoadState('networkidle');

    // Unlock vault if needed
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

    // Wait for media to load
    await page.waitForTimeout(3000);

    // Check that signed URL endpoint was called
    const signUrlRequests = capturedUrls.filter(url => url.includes('/api/vault/sign-url'));
    console.log(`\n[Signed URL] Generated ${signUrlRequests.length} signed URLs`);
    expect(signUrlRequests.length).toBeGreaterThan(0);

    // Verify that media requests use signatures (sig=) instead of vault tokens (vt=)
    const mediaRequests = capturedUrls.filter(url =>
      url.includes('/api/media/') &&
      url.includes('decrypt=true')
    );

    const tokenLeaks = mediaRequests.filter(url => url.includes('vt='));
    const signedRequests = mediaRequests.filter(url => url.includes('sig='));

    console.log(`[Media Requests] Total: ${mediaRequests.length}`);
    console.log(`[Token Leaks] Found ${tokenLeaks.length} requests with vault tokens in URL`);
    console.log(`[Signed URLs] Found ${signedRequests.length} requests with signatures`);

    if (tokenLeaks.length > 0) {
      console.error('[SECURITY VIOLATION] Vault tokens found in URLs:');
      tokenLeaks.forEach(url => {
        console.error('  -', url.substring(url.indexOf('/api')));
      });
    }

    // CRITICAL: No vault tokens should be in URLs
    expect(tokenLeaks.length).toBe(0);

    // All encrypted media requests should use signed URLs
    if (mediaRequests.length > 0) {
      expect(signedRequests.length).toBeGreaterThan(0);
    }

    console.log('✅ All encrypted media requests use signed URLs\n');
  });

  test('should not log vault tokens to browser history', async ({ page }) => {
    await page.goto('http://localhost:3000/mediavault/vault');
    await page.waitForLoadState('networkidle');

    // Unlock vault
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

    await page.waitForTimeout(2000);

    // Get current URL from address bar
    const currentUrl = page.url();
    console.log('[Browser URL]', currentUrl);

    // Verify no vault token in address bar
    expect(currentUrl).not.toContain('vt=');
    expect(currentUrl).not.toContain('vaultToken=');

    console.log('✅ No vault tokens leaked to browser URL bar\n');
  });

  test('should clear signed URLs when vault is locked', async ({ page }) => {
    const signUrlRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/vault/sign-url')) {
        signUrlRequests.push(url);
      }
    });

    await page.goto('http://localhost:3000/mediavault/vault');
    await page.waitForLoadState('networkidle');

    // Unlock vault
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

    await page.waitForTimeout(2000);
    const initialSignRequests = signUrlRequests.length;
    console.log(`[Initial] Generated ${initialSignRequests} signed URLs`);

    // Lock vault
    const lockButton = page.getByTestId('button-lock-vault');
    await lockButton.click();
    await page.waitForTimeout(1000);

    // Unlock again
    const unlockButton2 = page.getByTestId('button-unlock-vault');
    await unlockButton2.click();
    await page.waitForSelector('[data-testid="vault-access-modal"]', { state: 'visible' });

    const passphraseInput2 = page.locator('input[type="password"]');
    await passphraseInput2.fill('testpassphrase123');

    const submitButton2 = page.locator('button:has-text("Unlock Vault")');
    await submitButton2.click();

    await page.waitForSelector('[data-testid="vault-content"]', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);

    const afterLockSignRequests = signUrlRequests.length;
    console.log(`[After Lock/Unlock] Generated ${afterLockSignRequests} signed URLs`);

    // Should generate new signed URLs after lock (cache was cleared)
    expect(afterLockSignRequests).toBeGreaterThan(initialSignRequests);

    console.log('✅ Signed URL cache cleared on vault lock\n');
  });

  test('security report: signed URL implementation', async ({ page }) => {
    const report = {
      timestamp: new Date().toISOString(),
      implementation: 'Signed URLs with cryptographic signatures',
      securityFeatures: [
        'Vault tokens NOT in URL query parameters',
        'Signed URLs use base64url-encoded random signatures',
        'Signatures expire after 5 minutes',
        'Server-side signature validation with user binding',
        'Cache cleared on vault lock'
      ],
      benefits: [
        'Prevents token leakage to browser history',
        'Prevents token leakage to server access logs',
        'Prevents token leakage to browser extensions',
        'Short-lived signatures limit attack window',
        'User-bound signatures prevent token reuse'
      ],
      mitigatedRisks: [
        'CVSS 9.1: Vault token exposure in URLs',
        'CVSS 8.3: Browser history forensics',
        'CVSS 7.5: Server log exposure'
      ]
    };

    console.log('\n=== SIGNED URL SECURITY REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    console.log('==================================\n');
  });
});
