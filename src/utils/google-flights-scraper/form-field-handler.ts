import { ElementHandle, Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

// Helper function to clear an input field using multiple methods
async function clearInputField(page: Page, field: ElementHandle<Element>): Promise<void> {
  log(LOG_LEVEL.DEBUG, "Attempting to clear input field using multiple methods");

  try {
    // Method 1: Try using Puppeteer's built-in clear method
    await field.evaluate((el) => {
      if (el instanceof HTMLInputElement) {
        el.value = "";
      } else if (el.hasAttribute("contenteditable")) {
        el.textContent = "";
      }
    });
    log(LOG_LEVEL.DEBUG, "Attempted to clear field using JavaScript");

    // Method 2: Click three times to select all text (works for many inputs)
    await field.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    log(LOG_LEVEL.DEBUG, "Attempted to clear field using triple-click and backspace");

    // Method 3: Use keyboard shortcuts
    await field.click(); // Ensure field is focused
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100))); // Small delay to ensure focus
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100))); // Small delay after selection
    await page.keyboard.press("Backspace");
    log(LOG_LEVEL.DEBUG, "Attempted to clear field using Ctrl+A and backspace");

    // Method 4: Try to clear by sending multiple backspace keys
    await field.click();
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Backspace");
    }
    log(LOG_LEVEL.DEBUG, "Attempted to clear field using multiple backspaces");

    // Final verification - check if field is empty
    const value = await field.evaluate((el) => {
      if (el instanceof HTMLInputElement) {
        return el.value;
      } else if (el.hasAttribute("contenteditable")) {
        return el.textContent;
      }
      return null;
    });

    if (value && value.length > 0) {
      log(LOG_LEVEL.WARN, `Field may not be completely cleared, current value length: ${value.length}`);
    } else {
      log(LOG_LEVEL.DEBUG, "Field appears to be cleared successfully");
    }
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error while trying to clear input field:", error);
    // Continue despite errors - we've tried multiple methods
  }
}

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


    if (inputFields.length > 0) {
      // Use the first input field as the origin field
      originField = inputFields[0];
      log(LOG_LEVEL.INFO, "Using first input field as origin field");
    } else {
      log(LOG_LEVEL.ERROR, "Could not find any input fields");

      throw new Error("Could not find any input fields");
    }
  }

  // Click on the origin field
  await originField.click();
  log(LOG_LEVEL.INFO, "Clicked on origin input field");


  // Clear the origin field using our robust clearing function
  await clearInputField(page, originField);
  log(LOG_LEVEL.INFO, "Attempted to clear origin field using multiple methods");

  // Type the origin with a slower delay to ensure Google Flights can process it
  // Remove commas from the input to avoid issues with Google Flights
  const sanitizedFrom = from.replace(/,/g, "");
  log(LOG_LEVEL.INFO, `Typing origin with slower delay (sanitized): ${sanitizedFrom}`);
  await page.keyboard.type(sanitizedFrom, { delay: 200 });


  // Wait longer for suggestions to appear and stabilize
  log(LOG_LEVEL.INFO, "Waiting for suggestions to appear and stabilize");
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

  // Wait for suggestions dropdown
  try {
    await page.waitForSelector('[role="listbox"], [role="option"], .suggestions-list', { timeout: 5000 });
    log(LOG_LEVEL.INFO, "Suggestions dropdown appeared");
  } catch {
    log(LOG_LEVEL.WARN, "No suggestions dropdown found after typing origin, continuing anyway");
  }

  // Take a screenshot of the suggestions


  // Wait a moment before selecting to ensure suggestions are fully loaded
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

  // Press Enter to select the first suggestion
  log(LOG_LEVEL.INFO, "Pressing Enter to select first suggestion");
  await page.keyboard.press("Enter");

  // Wait after selection to ensure it's processed
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
  log(LOG_LEVEL.INFO, "Selected origin");

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


    if (inputFields.length > 1) {
      // Use the second input field as the destination field
      destinationField = inputFields[1];
      log(LOG_LEVEL.INFO, "Using second input field as destination field");
    } else {
      log(LOG_LEVEL.ERROR, "Could not find enough input fields for destination");

      throw new Error("Could not find destination field");
    }
  }

  // Click on the destination field
  await destinationField.click();
  log(LOG_LEVEL.INFO, "Clicked on destination input field");


  // Clear the destination field using our robust clearing function
  await clearInputField(page, destinationField);
  log(LOG_LEVEL.INFO, "Attempted to clear destination field using multiple methods");

  // Type the destination with a slower delay to ensure Google Flights can process it
  // Remove commas from the input to avoid issues with Google Flights
  const sanitizedTo = to.replace(/,/g, "");
  log(LOG_LEVEL.INFO, `Typing destination with slower delay (sanitized): ${sanitizedTo}`);
  await page.keyboard.type(sanitizedTo, { delay: 200 });


  // Wait longer for suggestions to appear and stabilize
  log(LOG_LEVEL.INFO, "Waiting for suggestions to appear and stabilize");
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

  // Wait for suggestions dropdown
  try {
    await page.waitForSelector('[role="listbox"], [role="option"], .suggestions-list', { timeout: 5000 });
    log(LOG_LEVEL.INFO, "Suggestions dropdown appeared");
  } catch {
    log(LOG_LEVEL.WARN, "No suggestions dropdown found after typing destination, continuing anyway");
  }

  // Take a screenshot of the suggestions


  // Wait a moment before selecting to ensure suggestions are fully loaded
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

  // Press Enter to select the first suggestion
  log(LOG_LEVEL.INFO, "Pressing Enter to select first suggestion");
  await page.keyboard.press("Enter");

  // Wait after selection to ensure it's processed
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
  log(LOG_LEVEL.INFO, "Selected destination");

}
