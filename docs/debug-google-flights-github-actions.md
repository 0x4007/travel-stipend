# Debugging Google Flights Scraper in GitHub Actions

## Overview of the Issue

Google Flights scraping works locally in headless mode but fails in GitHub Actions environments. The observed errors include:

- `delay is not a function` in the alliance filter handler
- Date input fields not being detected
- Protocol errors like `Protocol error (Runtime.callFunctionOn): Argument should belong to the same JavaScript world as target object`
- Selector issues and element interaction failures

## Comprehensive Debugging Approach

### 1. Enhanced Screenshot Capture System

#### Critical Points for Screenshot Capture

- **Initial Navigation**

  - After browser launch
  - After navigating to Google Flights
  - After the page is fully loaded

- **Currency Selection**

  - Before clicking currency button
  - After clicking currency button
  - After currency dialog appears
  - After selecting USD
  - After currency change confirmation

- **Form Interaction**

  - Before entering origin/destination
  - After entering origin/destination
  - Before dropdown selection (if applicable)
  - After dropdown selection
  - All form fields with highlights

- **Date Selection**

  - Before clicking date fields
  - After date field dialog opens
  - During date selection process
  - After dates are selected

- **Alliance Filter Process**

  - Before clicking airline filter button
  - After airline filter panel opens
  - During alliance checkbox selection
  - After all alliance filters applied

- **Error Conditions**

  - At the exact moment when any error occurs
  - State of the page immediately before errors
  - With error details overlaid on screenshot

- **Results Pages**
  - Flight search results
  - Page with all applied filters

### 2. Enhanced Screenshot Handler Functionality

```typescript
// Enhanced screenshot handler
async function enhancedScreenshot(
  page: Page,
  description: string,
  options: {
    fullPage?: boolean;
    captureHtml?: boolean;
    logDOM?: boolean;
    highlightElements?: string[];
    dumpConsole?: boolean;
  } = {}
): Promise<string> {
  // Implementation details here
}
```

Improvements to implement:

- Full page vs. viewport screenshots
- HTML source capture alongside PNG
- DOM snapshots at critical points
- Element highlighting before capture
- Detailed metadata files with each screenshot
- Capture console logs with screenshots
- Viewport size and user agent information
- Performance metrics at capture time

### 3. Artifact Configuration in GitHub Actions

```yaml
- name: Upload debug screenshots
  uses: actions/upload-artifact@v3
  with:
    name: google-flights-debug-screenshots
    path: test-screenshots/
    retention-days: 5

- name: Upload debug logs
  uses: actions/upload-artifact@v3
  with:
    name: google-flights-debug-logs
    path: debug-logs/
    retention-days: 5
```

Artifact structure:

- Organized by timestamp/sequence
- Linked HTML and screenshot files
- Metadata JSON with each screenshot
- Consolidated debug log
- Index file for easier navigation

### 4. GitHub Workflow Modifications

```yaml
jobs:
  calculate:
    runs-on: ubuntu-latest
    env:
      DEBUG_GOOGLE_FLIGHTS: true
      CAPTURE_SCREENSHOTS: true
      SCREENSHOT_QUALITY: high
      PUPPETEER_TIMEOUT: 60000
      DETAILED_LOGGING: true
    steps:
      # Existing steps...

      # New debug steps
      - name: Setup debugging environment
        run: |
          mkdir -p test-screenshots
          mkdir -p debug-logs

      # Continue with existing steps...
```

Required changes:

- Add debug environment variables
- Increase timeouts for all Puppeteer operations
- Add screenshot directory preparation
- Add artifact upload steps
- Modify logging levels

### 5. Enhanced Error Handling

```typescript
try {
  // Existing code
} catch (error) {
  // Enhanced error capture
  await enhancedScreenshot(page, `error-${operationName}`, {
    fullPage: true,
    captureHtml: true,
    logDOM: true,
    dumpConsole: true,
  });

  // Log additional details
  log(
    LOG_LEVEL.ERROR,
    `Error details: ${JSON.stringify({
      message: error.message,
      stack: error.stack,
      pageUrl: page.url(),
      timestamp: new Date().toISOString(),
    })}`
  );

  throw error;
}
```

Error handling improvements:

- Contextual error capturing with screenshots
- Detailed error information collection
- Console state at time of error
- Network request status at failure points
- Puppeteer execution context details

### 6. Implementation Plan

1. **Modify Screenshot Handler**

   - Update `screenshot-handler.ts` to support enhanced options
   - Add HTML source capture functionality
   - Implement metadata JSON generation

2. **Add Screenshot Capture Points**

   - Update each step in the Google Flights scraper to capture state
   - Add pre/post condition screenshots for all critical operations
   - Implement error boundary screenshots

3. **Update GitHub Workflow**

   - Add environment variables for debugging
   - Configure artifact upload steps
   - Add debug setup steps

4. **Enhance Error Reporting**

   - Improve error context collection
   - Add DOM state capture on errors
   - Implement network request logging

5. **Add Helper Utilities**

   - Create DOM state inspection utilities
   - Add element highlight functionality for screenshots
   - Implement console log capture mechanism

6. **Testing & Verification**
   - Test locally with headless mode
   - Verify artifact collection
   - Confirm screenshot quality and usefulness

## Potential Fixes Based on Debug Information

Once we have comprehensive debug information, we can implement targeted fixes:

1. **Browser Configuration Adjustments**

   - Modify launch arguments
   - Adjust viewport settings
   - Change user agent

2. **Timing Improvements**

   - Add strategic delays
   - Implement better wait conditions
   - Use more reliable element selectors

3. **Fallback Mechanisms**

   - Implement multiple selector strategies
   - Add JavaScript execution fallbacks
   - Create DOM traversal alternatives

4. **Error Recovery**
   - Add retry mechanisms with exponential backoff
   - Implement session recovery
   - Add alternative navigation paths

The goal is to collect enough detailed information to understand exactly why the scraper behaves differently in GitHub Actions versus local environments, and then implement targeted fixes.
