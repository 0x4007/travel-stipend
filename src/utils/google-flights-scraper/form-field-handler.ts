import { ElementHandle, Page } from "puppeteer";
import { LOG_LEVEL } from "./config";
import { log } from "./log";

/**
 * Extracts just the city name from a destination string
 * Examples:
 * "New York, USA" -> "New York"
 * "Abu Dhabi, UAE" -> "Abu Dhabi"
 * "Prague, Czech Republic" -> "Prague"
 */
function extractCityName(destination: string): string {
  // First try to split by comma and take the first part
  if (destination.includes(",")) {
    return destination.split(",")[0].trim();
  }

  // If no comma, try to extract the first word or words that likely represent the city
  // This is a simple heuristic and might need refinement
  const words = destination.split(" ");
  if (words.length <= 2) {
    return destination.trim(); // If it's just 1-2 words, use the whole string
  }

  // For longer strings, use the first two words as they likely represent the city
  // This is a simple approach and might need adjustment for specific cases
  return words.slice(0, 2).join(" ").trim();
}

// Helper function to create a delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100))); // Small delay to ensure focus
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100))); // Small delay after selection
    await page.keyboard.press("Backspace");
    log(LOG_LEVEL.DEBUG, "Attempted to clear field using Ctrl+A and backspace");

    // Method 4: Try to clear by sending multiple backspace keys
    await field.click();
    // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
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
    log(LOG_LEVEL.ERROR, "Error while trying to clear input field:", error instanceof Error ? error.message : String(error));
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
  // log(LOG_LEVEL.INFO, "Waiting for suggestions to appear and stabilize");
  // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

  // Wait for suggestions dropdown
  try {
    await page.waitForSelector('[role="listbox"], [role="option"], .suggestions-list', { timeout: 5000 });
    log(LOG_LEVEL.INFO, "Suggestions dropdown appeared");
  } catch {
    log(LOG_LEVEL.WARN, "No suggestions dropdown found after typing origin, continuing anyway");
  }

  // Take a screenshot of the suggestions

  // Wait a moment before selecting to ensure suggestions are fully loaded
  // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

  // Press Enter to select the first suggestion
  log(LOG_LEVEL.INFO, "Pressing Enter to select first suggestion");
  await page.keyboard.press("Enter");

  // Wait after selection to ensure it's processed
  // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
  log(LOG_LEVEL.INFO, "Selected origin");
}

export async function fillDestinationField(page: Page, to: string): Promise<{ success: boolean; selectedDestination: string | null }> {
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

  // Extract just the city name from the destination string
  // This helps avoid issues with Google Flights not recognizing full destination strings
  const cityOnly = extractCityName(to);
  log(LOG_LEVEL.INFO, `Typing destination city only: ${cityOnly} (from: ${to})`);
  await page.keyboard.type(cityOnly, { delay: 200 });

  // Wait longer for suggestions to appear and stabilize
  // log(LOG_LEVEL.INFO, "Waiting for suggestions to appear and stabilize");
  // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

  // Wait for suggestions dropdown
  try {
    await page.waitForSelector('[role="listbox"], [role="option"], .suggestions-list', { timeout: 5000 });
    log(LOG_LEVEL.INFO, "Suggestions dropdown appeared");
  } catch {
    log(LOG_LEVEL.WARN, "No suggestions dropdown found after typing destination, continuing anyway");
  }

  // Take a screenshot of the suggestions

  // Wait a moment before selecting to ensure suggestions are fully loaded
  // await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

  // Press Enter to select the first suggestion
  log(LOG_LEVEL.INFO, "Pressing Enter to select first suggestion");
  await page.keyboard.press("Enter");

  // Wait after selection to ensure it's processed
  await delay(1000);

  // Wait a bit longer to ensure the field is updated
  await delay(2000);

  // Verify the selected destination
  let selectedDestination: string | null = null;
  try {
    // Try to get the selected destination from the input field
    selectedDestination = await destinationField.evaluate((el) => {
      if (el instanceof HTMLInputElement) {
        return el.value;
      } else if (el.hasAttribute("contenteditable")) {
        return el.textContent;
      }
      return null;
    });

    if (selectedDestination) {
      log(LOG_LEVEL.INFO, `Selected destination: ${selectedDestination}`);

      // Check if the selected destination contains the city name
      const cityName = extractCityName(to).toLowerCase().trim();
      const normalizedSelected = selectedDestination.toLowerCase().trim();

      // Check if either string contains the other
      if (normalizedSelected.includes(cityName) || cityName.includes(normalizedSelected)) {
        log(LOG_LEVEL.INFO, `Destination match confirmed: ${cityName} matches ${normalizedSelected}`);
      } else {
        log(LOG_LEVEL.WARN, `Destination mismatch! Expected city: ${cityName}, Got: ${normalizedSelected}`);

        // Try to get the destination from the page title as a fallback
        const pageTitle = await page.title();
        log(LOG_LEVEL.INFO, `Page title: ${pageTitle}`);

        if (pageTitle.toLowerCase().includes(cityName)) {
          log(LOG_LEVEL.INFO, `Found destination in page title: ${pageTitle}`);
          selectedDestination = cityName;
          return { success: true, selectedDestination };
        }

        return { success: false, selectedDestination };
      }
    } else {
      log(LOG_LEVEL.WARN, "Could not verify selected destination from input field");

      // Try to get the destination from the page title as a fallback
      const pageTitle = await page.title();
      log(LOG_LEVEL.INFO, `Page title: ${pageTitle}`);

      const cityName = extractCityName(to).toLowerCase().trim();
      if (pageTitle.toLowerCase().includes(cityName)) {
        log(LOG_LEVEL.INFO, `Found destination in page title: ${pageTitle}`);
        selectedDestination = cityName;
        return { success: true, selectedDestination };
      }
    }
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error verifying destination:", error instanceof Error ? error.message : String(error));
  }

  log(LOG_LEVEL.INFO, "Selected destination");
  return { success: true, selectedDestination };
}
