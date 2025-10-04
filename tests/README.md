# MediaVault E2E Test Suite

Comprehensive Playwright end-to-end testing suite for the MediaVault application.

## Quick Start

```bash
# Run all tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# View test report
npm run test:report
```

## Running Specific Test Suites

```bash
# Authentication tests only
npx playwright test auth.spec.ts

# Security tests only
npx playwright test security.spec.ts

# Performance tests only
npx playwright test performance.spec.ts

# API tests only
npx playwright test api.spec.ts

# Run specific test by name
npx playwright test -g "should load home page"
```

## Running Tests on Different Browsers

```bash
# Chromium only (default)
npx playwright test --project=chromium

# Firefox only
npx playwright test --project=firefox

# WebKit only
npx playwright test --project=webkit

# All browsers
npx playwright test
```

## Running Tests on Mobile Devices

```bash
# iPhone SE
npx playwright test --project=iphone-se

# iPhone 12 Pro
npx playwright test --project=iphone-12-pro

# Pixel 5
npx playwright test --project=pixel-5

# iPad
npx playwright test --project=ipad-portrait
```

## Test Organization

### Page Object Models
Located in `tests/e2e/pages/`

- **BasePage.ts** - Common functionality for all pages
- **LandingPage.ts** - Landing/login page interactions
- **HomePage.ts** - Authenticated home page
- **GalleryPage.ts** - Media gallery and upload
- **VaultPage.ts** - Encrypted vault operations

### Test Suites

#### Authentication Tests (`auth.spec.ts`)
- Login/logout flow
- Session persistence
- Authentication enforcement
- Cookie security

#### Navigation Tests (`navigation.spec.ts`)
- Route navigation
- Browser history
- Direct URL access
- 404 handling

#### Media Upload Tests (`media-upload.spec.ts`)
- File upload functionality
- File type validation
- Multi-file uploads
- Drag and drop
- Media display and management

#### Security Tests (`security.spec.ts`)
- XSS prevention
- SQL injection protection
- CSRF validation
- Path traversal prevention
- Authentication enforcement
- Vault security

#### Responsive UI Tests (`responsive-ui.spec.ts`)
- Desktop layout
- Mobile layout
- Tablet layout
- Touch interactions
- Visual regression
- Accessibility

#### Performance Tests (`performance.spec.ts`)
- Page load times
- Core Web Vitals
- Resource loading
- API response times
- Memory leak detection
- Bundle size analysis

#### Error Handling Tests (`error-handling.spec.ts`)
- 404 error handling
- API error responses
- Network errors
- Form validation
- Session expiration
- Error recovery

#### API Tests (`api.spec.ts`)
- Health check endpoint
- Media endpoints
- Categories API
- Upload API
- Vault API
- User API
- Search API
- Rate limiting

## Test Utilities

Located in `tests/e2e/helpers/test-utils.ts`

### Available Helper Functions

```typescript
// Authentication helpers
await login(page);
await logout(page);

// File creation
const imagePath = createTestImage('test.jpg');
const textPath = createTestTextFile('test.txt', 'content');

// UI helpers
await waitForToast(page, 'Success message');
await takeTimestampedScreenshot(page, 'screenshot-name');
await waitForNetworkIdle(page);

// Utilities
const logs = await captureConsoleLogs(page);
const requests = await captureNetworkRequests(page);
const inViewport = await isInViewport(page, 'selector');
await scrollIntoView(page, 'selector');
const str = randomString(10);
```

## Debugging Tests

### Run in Debug Mode
```bash
# Open Playwright Inspector
npx playwright test --debug

# Debug specific test
npx playwright test auth.spec.ts --debug
```

### View Test Traces
```bash
# Traces are automatically captured on first retry
npx playwright show-trace test-results/.../trace.zip
```

### Screenshots and Videos
- Screenshots: Captured on failure
- Videos: Recorded on failure
- Location: `test-results/` directory

## Configuration

### Environment Variables
```bash
# Custom base URL
BASE_URL=http://localhost:3001/mediavault npx playwright test

# Run in CI mode
CI=true npx playwright test
```

### Playwright Config
Edit `playwright.config.ts` to customize:
- Base URL
- Timeout values
- Browser projects
- Screenshot settings
- Video recording
- Reporters

## Test Fixtures

Test files should be placed in `tests/fixtures/`

### Creating Test Files
```typescript
// In your test
import { createTestImage } from './helpers/test-utils';

test('upload image', async ({ page }) => {
  const imagePath = createTestImage('my-test-image.jpg');
  await page.setInputFiles('input[type="file"]', imagePath);
});
```

## Best Practices

### 1. Use Page Object Models
```typescript
import { GalleryPage } from './pages/GalleryPage';

test('upload file', async ({ page }) => {
  const gallery = new GalleryPage(page);
  await gallery.navigate();
  await gallery.uploadFile('path/to/file.jpg');
});
```

### 2. Use data-testid Attributes
```html
<!-- Recommended -->
<button data-testid="upload-button">Upload</button>

<!-- Usage in test -->
await page.getByTestId('upload-button').click();
```

### 3. Wait for Network Idle
```typescript
await page.goto('/gallery');
await page.waitForLoadState('networkidle');
```

### 4. Use Soft Assertions for Multiple Checks
```typescript
await expect.soft(element1).toBeVisible();
await expect.soft(element2).toBeVisible();
await expect.soft(element3).toBeVisible();
```

### 5. Handle Timeouts Gracefully
```typescript
await expect(element).toBeVisible({ timeout: 10000 });
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Tests Timing Out
- Increase timeout in `playwright.config.ts`
- Check if application is running on correct port
- Verify network connectivity
- Check for blocking dialogs or popups

### Element Not Found
- Use Playwright Inspector: `npx playwright test --debug`
- Check if element has correct data-testid
- Verify element is not in shadow DOM
- Wait for element to appear before interacting

### Flaky Tests
- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Use `test.retry(2)` for specific tests
- Check for race conditions
- Avoid fixed timeouts, use event-based waiting

### Screenshots Not Capturing
- Check `playwright.config.ts` screenshot settings
- Verify test is actually failing
- Check disk space
- Review file permissions

## Test Coverage Goals

- **Unit Tests**: 70% (not yet implemented)
- **Integration Tests**: 20% (partial coverage)
- **E2E Tests**: 10% (comprehensive coverage achieved)

## Contributing

When adding new tests:

1. Follow existing Page Object Model patterns
2. Add descriptive test names
3. Use appropriate test data
4. Clean up after tests (if needed)
5. Update this README if adding new suites

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Debugging Guide](https://playwright.dev/docs/debug)
