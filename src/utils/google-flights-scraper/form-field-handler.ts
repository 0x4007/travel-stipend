import { Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";
import { takeScreenshot } from "./take-screenshot";

export async function fillOriginField(page: Page, from: string): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "STEP 1: Finding and filling origin field");

  // Try multiple possible selectors for the origin field
  const possibleOriginSelectors = [
    '[data-placeholder="Where from?"]',
    '[placeholder="Where from?"]',
    '[aria-label="Where from?"]',
    'input[aria-label*="Origin"]',
    '[role="combobox"][aria-label*="Origin"]',
    // Add more potential selectors
  ];

  // Try to find the origin field
  let originField = null;
  for (const selector of possibleOriginSelectors) {
    log(LOG_LEVEL.DEBUG, `Trying origin selector: ${selector}`);
    try {
      const field = await page.$(selector);
      if (field) {
        originField = field;
        log(LOG_LEVEL.INFO, `Found origin input with selector: ${selector}`);
        break;
      }
    } catch {
      log(LOG_LEVEL.DEBUG, `Selector ${selector} not found`);
    }
  }

  // If we couldn't find the origin field with specific selectors, try to find any input field
  if (!originField) {
    log(LOG_LEVEL.WARN, "Could not find origin field with specific selectors, trying to find any input field");

    // Find all input fields
    const inputFields = await page.$$('input, [role="combobox"], [contenteditable="true"]');
    log(LOG_LEVEL.DEBUG, `Found ${inputFields.length} potential input fields`);

    // Take a screenshot of all input fields
    await takeScreenshot(page, "all-input-fields");

    if (inputFields.length > 0) {
      // Use the first input field as the origin field
      originField = inputFields[0];
      log(LOG_LEVEL.INFO, "Using first input field as origin field");
    } else {
      log(LOG_LEVEL.ERROR, "Could not find any input fields");
      await takeScreenshot(page, "error-no-input-fields");
      throw new Error("Could not find any input fields");
    }
  }

  // Click on the origin field
  await originField.click();
  log(LOG_LEVEL.INFO, "Clicked on origin input field");
  await takeScreenshot(page, "after-click-origin-field");

  // Clear the origin field
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");

  // Type the origin
  await page.keyboard.type(from, { delay: 100 });
  log(LOG_LEVEL.INFO, `Typed origin: ${from}`);
  await takeScreenshot(page, "after-type-origin");

  // Wait for suggestions and select the first one
  await page
    .waitForSelector('[role="listbox"], [role="option"], .suggestions-list', { timeout: 5000 })
    .catch(() => log(LOG_LEVEL.WARN, "No suggestions dropdown found after typing origin"));

  // Take a screenshot of the suggestions
  await takeScreenshot(page, "origin-suggestions");

  // Press Enter to select the first suggestion
  await page.keyboard.press("Enter");
  log(LOG_LEVEL.INFO, "Pressed Enter to select origin");
  await takeScreenshot(page, "after-select-origin");
}

export async function fillDestinationField(page: Page, to: string): Promise<void> {
  if (!page) throw new Error("Page not initialized");

  log(LOG_LEVEL.INFO, "STEP 2: Finding and filling destination field");

  // Try multiple possible selectors for the destination field
  const possibleDestinationSelectors = [
    '[data-placeholder="Where to?"]',
    '[placeholder="Where to?"]',
    '[aria-label="Where to?"]',
    'input[aria-label*="Destination"]',
    '[role="combobox"][aria-label*="Destination"]',
    // Add more potential selectors
  ];

  // Take a screenshot before finding destination field
  await takeScreenshot(page, "before-finding-destination-field");

  // Try to find the destination field
  let destinationField = null;
  for (const selector of possibleDestinationSelectors) {
    log(LOG_LEVEL.DEBUG, `Trying destination selector: ${selector}`);
    try {
      const field = await page.$(selector);
      if (field) {
        destinationField = field;
        log(LOG_LEVEL.INFO, `Found destination input with selector: ${selector}`);
        break;
      }
    } catch {
      log(LOG_LEVEL.DEBUG, `Selector ${selector} not found`);
    }
  }

  // If we couldn't find the destination field with specific selectors, try to find the second input field
  if (!destinationField) {
    log(LOG_LEVEL.WARN, "Could not find destination field with specific selectors, trying to find second input field");

    // Find all input fields
    const inputFields = await page.$$('input, [role="combobox"], [contenteditable="true"]');
    log(LOG_LEVEL.DEBUG, `Found ${inputFields.length} potential input fields`);

    // Take a screenshot of all input fields
    await takeScreenshot(page, "all-input-fields-for-destination");

    if (inputFields.length > 1) {
      // Use the second input field as the destination field
      destinationField = inputFields[1];
      log(LOG_LEVEL.INFO, "Using second input field as destination field");
    } else {
      log(LOG_LEVEL.ERROR, "Could not find enough input fields for destination");
      await takeScreenshot(page, "error-no-destination-field");
      throw new Error("Could not find destination field");
    }
  }

  // Click on the destination field
  await destinationField.click();
  log(LOG_LEVEL.INFO, "Clicked on destination input field");
  await takeScreenshot(page, "after-click-destination-field");

  // Clear the destination field
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");

  // Type the destination
  await page.keyboard.type(to, { delay: 100 });
  log(LOG_LEVEL.INFO, `Typed destination: ${to}`);
  await takeScreenshot(page, "after-type-destination");

  // Wait for suggestions and select the first one
  await page
    .waitForSelector('[role="listbox"], [role="option"], .suggestions-list', { timeout: 5000 })
    .catch(() => log(LOG_LEVEL.WARN, "No suggestions dropdown found after typing destination"));

  // Take a screenshot of the suggestions
  await takeScreenshot(page, "destination-suggestions");

  // Press Enter to select the first suggestion
  await page.keyboard.press("Enter");
  log(LOG_LEVEL.INFO, "Pressed Enter to select destination");
  await takeScreenshot(page, "after-select-destination");
}
