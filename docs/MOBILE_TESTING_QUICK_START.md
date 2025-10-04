# Mobile Testing Quick Start Guide

## Prerequisites

1. **Install Playwright browsers:**
   ```bash
   npx playwright install webkit chromium
   ```

2. **Start development server:**
   ```bash
   npm run start:dev
   ```

## Running Tests

### Quick Commands

```bash
# Run ALL mobile tests
npx playwright test tests/e2e/mobile-ux.spec.ts

# Run on specific device
npx playwright test tests/e2e/mobile-ux.spec.ts --project=iphone-12-pro

# Run with visible browser
npx playwright test tests/e2e/mobile-ux.spec.ts --headed

# Run specific test category
npx playwright test tests/e2e/mobile-ux.spec.ts --grep "Touch Gestures"

# Debug mode (step through tests)
npx playwright test tests/e2e/mobile-ux.spec.ts --debug

# View test report
npx playwright show-report
```

### PowerShell Test Runner

```powershell
# Run all tests with automated setup
.\tests\mobile-test-runner.ps1

# Run on specific device
.\tests\mobile-test-runner.ps1 -Device "iphone-12-pro"

# Run with headed browser
.\tests\mobile-test-runner.ps1 -Headed

# Skip build step (faster)
.\tests\mobile-test-runner.ps1 -SkipBuild
```

## Available Devices

| Project Name | Device | Viewport |
|--------------|--------|----------|
| `iphone-se` | iPhone SE | 375x667 |
| `iphone-12-pro` | iPhone 12 Pro | 390x844 |
| `iphone-12-pro-max` | iPhone 12 Pro Max | 428x926 |
| `pixel-5` | Google Pixel 5 | 393x851 |
| `galaxy-s21` | Samsung Galaxy S21 | 360x800 |
| `ipad-portrait` | iPad Portrait | 768x1024 |
| `ipad-landscape` | iPad Landscape | 1024x768 |

## Test Categories

Filter tests by category using `--grep`:

- **Touch Gestures:** `--grep "Touch Gestures"`
- **Music Player:** `--grep "Music Player"`
- **Touch Targets:** `--grep "Touch Target"`
- **Responsive:** `--grep "Responsive Layout"`
- **Performance:** `--grep "Performance"`
- **Visual:** `--grep "Visual Regression"`
- **Accessibility:** `--grep "Accessibility"`

## Common Tasks

### 1. Test a New Mobile Feature

```bash
# Test on mobile devices only
npx playwright test tests/e2e/mobile-ux.spec.ts --project=iphone-12-pro --project=pixel-5
```

### 2. Update Visual Regression Baselines

```bash
# Update screenshots after intentional UI changes
npx playwright test tests/e2e/mobile-ux.spec.ts --update-snapshots
```

### 3. Check Touch Target Sizes

```bash
# Validate WCAG AAA compliance
npx playwright test tests/e2e/mobile-ux.spec.ts --grep "Touch Target Validation"
```

### 4. Test Performance

```bash
# Check mobile performance metrics
npx playwright test tests/e2e/mobile-ux.spec.ts --grep "Performance"
```

### 5. Cross-Device Testing

```bash
# Run same test on all devices
npx playwright test tests/e2e/mobile-ux.spec.ts --grep "should load on"
```

## Understanding Test Results

### Pass ✅
```
✓ [iphone-12-pro] › mobile-ux.spec.ts:39 › should navigate to next image on swipe left (2.5s)
```
Test completed successfully.

### Fail ❌
```
✗ [iphone-12-pro] › mobile-ux.spec.ts:90 › should navigate to previous image on swipe right (1.2s)
  Error: expect(received).not.toBe(expected)
```
Test failed. Check the error message and trace.

### Skip ⊘
```
⊘ [iphone-12-pro] › mobile-ux.spec.ts:131 › should close lightbox on swipe down
  Need at least 2 media items for swipe test
```
Test was skipped (usually due to missing test data).

## Viewing Test Reports

### HTML Report (Recommended)

```bash
npx playwright show-report
```

Opens interactive HTML report in browser with:
- Test execution timeline
- Screenshots of failures
- Error traces
- Performance metrics

### JSON Report

```bash
cat test-results.json
```

Machine-readable test results for CI/CD integration.

### List Report

Tests output directly to console during execution.

## Adding New Mobile Tests

### Test Structure

```typescript
test('should do something on mobile', async ({ browser }) => {
  // Create mobile context
  const context = await browser.newContext({
    ...devices['iPhone 12 Pro']
  });
  const page = await context.newPage();

  // Navigate and test
  await page.goto('/gallery');

  // Your test logic here
  await expect(page.locator('[data-testid="media-grid"]')).toBeVisible();

  // Clean up
  await context.close();
});
```

### Best Practices

1. **Always close context:** `await context.close()` to prevent memory leaks
2. **Use data-testid:** More stable than CSS selectors
3. **Wait for visibility:** `await expect(...).toBeVisible()` before interactions
4. **Handle missing data:** Skip tests gracefully if test data is missing
5. **Add timeouts:** Increase timeout for slow operations

## Troubleshooting

### Tests Timing Out

```bash
# Increase timeout globally
npx playwright test --timeout=60000
```

Or per-test:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ...
});
```

### Browser Not Found

```bash
# Reinstall browsers
npx playwright install --with-deps
```

### Port Already in Use

```bash
# Kill existing server
npx kill-port 3000

# Or change port in playwright.config.ts
```

### Screenshots Don't Match

```bash
# Update baselines (after verifying changes are correct)
npx playwright test --update-snapshots

# Or ignore visual tests temporarily
npx playwright test --grep-invert "Visual Regression"
```

### Tests Pass Locally, Fail in CI

1. Check CI logs for specific errors
2. Ensure database is seeded with test data
3. Verify environment variables are set
4. Check for timing issues (add waits)

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main`
- Daily at 2 AM UTC

View results in GitHub Actions:
- Go to repository → Actions tab
- Select "Mobile UI Testing" workflow
- View test results and artifacts

## Performance Budgets

Current thresholds (fail if exceeded):

| Metric | Mobile Threshold |
|--------|------------------|
| FCP | < 2.5s |
| LCP | < 4.0s |
| TBT | < 500ms |
| CLS | < 0.1 |
| TTI | < 5.0s |

Run Lighthouse:
```bash
npm install -g @lhci/cli
lhci autorun --config=.lighthouserc.json
```

## File Locations

| File | Purpose |
|------|---------|
| `tests/e2e/mobile-ux.spec.ts` | Mobile test suite |
| `playwright.config.ts` | Device configurations |
| `.lighthouserc.json` | Performance budgets |
| `.github/workflows/mobile-testing.yml` | CI/CD pipeline |
| `tests/mobile-test-runner.ps1` | PowerShell test runner |

## Getting Help

**Test Documentation:**
- Full report: `docs/MOBILE_TESTING_REPORT.md`
- Playwright docs: https://playwright.dev

**Common Issues:**
1. Missing test data → Add sample media files
2. Flaky tests → Add proper waits
3. Visual regression fails → Update snapshots if changes are intentional

**Debug Tools:**
- UI Mode: `npx playwright test --ui`
- Debug Mode: `npx playwright test --debug`
- Trace Viewer: `npx playwright show-trace trace.zip`

---

**Quick Start Checklist:**

- [ ] Install Playwright browsers
- [ ] Start development server
- [ ] Run test suite
- [ ] View HTML report
- [ ] Check for failures
- [ ] Update snapshots if needed
- [ ] Commit changes

Happy Testing! 🚀
