import * as fs from "fs";
import * as path from "path";
import { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { clickSaveButtonInCurrencyDialog } from "./click-save-button-in-currency-dialog";
import { findAndClickCurrencyButton } from "./find-and-click-currency-button";
import { log } from "./log";
import { logAllClickableElements } from "./log-all-clickable-elements";
import { logAllInputs } from "./log-all-inputs";
import { selectUsdInCurrencyDialog } from "./select-usd-in-currency-dialog";
import { takeScreenshot } from "./take-screenshot";
import { verifyCurrencyChangeToUsd } from "./verify-currency-change-to-usd";

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Configure logging
export const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export const CURRENT_LOG_LEVEL = LOG_LEVEL.INFO; // Set to DEBUG for more detailed logging
export const SCREENSHOTS_DIR = path.join(process.cwd(), "logs", "screenshots");
const LOGS_DIR = path.join(process.cwd(), "logs");

// Ensure log directories exist
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Create log file stream
export const logFile = fs.createWriteStream(path.join(LOGS_DIR, `google-flights-${new Date().toISOString().replace(/:/g, "-")}.log`));

// Main scraper class
export class GoogleFlightsScraper {
  private _browser: Browser | null = null;
  private _page: Page | null = null;

  constructor() {
    log(LOG_LEVEL.INFO, "Initializing Google Flights Scraper");
  }

  async initialize(options = { headless: false }): Promise<void> {
    log(LOG_LEVEL.INFO, "Launching browser");
    this._browser = await puppeteer.launch({
      headless: options.headless, // Set to true for production
      defaultViewport: { width: 1366, height: 768 },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1366,768",
      ],
    });

    log(LOG_LEVEL.INFO, "Creating new page");
    this._page = await this._browser.newPage();

    // Set user agent
    await this._page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

    // Set extra HTTP headers
    await this._page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // Enable request interception for logging
    await this._page.setRequestInterception(true);
    this._page.on("request", (request) => {
      log(LOG_LEVEL.DEBUG, `Request: ${request.method()} ${request.url()}`);
      void request.continue();
    });

    // Log responses
    this._page.on("response", (response) => {
      log(LOG_LEVEL.DEBUG, `Response: ${response.status()} ${response.url()}`);
    });

    // Log console messages from the page
    this._page.on("console", (msg) => {
      log(LOG_LEVEL.DEBUG, `Console [${msg.type()}]: ${msg.text()}`);
    });

    // Log errors
    this._page.on("error", (error) => {
      log(LOG_LEVEL.ERROR, "Page error:", error);
    });

    // Log page errors
    this._page.on("pageerror", (error) => {
      log(LOG_LEVEL.ERROR, "Page JavaScript error:", error);
    });

    log(LOG_LEVEL.INFO, "Browser and page initialized");
  }

  async navigateToGoogleFlights(): Promise<void> {
    if (!this._page) throw new Error("Page not initialized");

    log(LOG_LEVEL.INFO, "Navigating to Google Flights");
    await this._page.goto("https://www.google.com/travel/flights", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    log(LOG_LEVEL.INFO, "Google Flights loaded");
    await takeScreenshot(this._page, "google-flights-loaded");

    // Log page title and URL
    const title = await this._page.title();
    const url = this._page.url();
    log(LOG_LEVEL.INFO, `Page loaded: ${title} (${url})`);

    // Log all inputs and clickable elements for debugging
    await logAllInputs(this._page);
    await logAllClickableElements(this._page);
  }

  // Split the changeCurrencyToUSD method into smaller methods to reduce cognitive complexity
  async _checkCurrentCurrency(): Promise<string | null> {
    if (!this._page) throw new Error("Page not initialized");

    try {
      const result = await this._page.evaluate((): string => {
        try {
          // Look for any visible currency indicators on the page
          const currencyElements = Array.from(document.querySelectorAll('[aria-label*="currency"], [class*="currency"]'));
          for (const el of currencyElements) {
            const text = el.textContent?.trim();
            if (text && (text.includes("USD") || text.includes("$"))) {
              return "USD";
            }
          }
          return "";
        } catch (e) {
          console.error("Error checking current currency:", e);
          return "";
        }
      });
      return result;
    } catch (error) {
      log(LOG_LEVEL.ERROR, "Error checking currency:", error);
      return "";
    }
  }

  async _handleCurrencyDialog(): Promise<boolean> {
    if (!this._page) throw new Error("Page not initialized");

    // Wait for currency dialog to appear
    await this._page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

    // Take screenshots of the currency dialog
    await takeScreenshot(this._page, "currency-dialog");
    await takeScreenshot(this._page, "currency-dialog-before-selection");

    // Log the dialog content for debugging
  const dialogContent = await this._page.evaluate((): string => {
    try {
      const dialog = document.querySelector('[role="dialog"], .dialog, [aria-modal="true"]');
      return dialog ? dialog.textContent ?? "" : document.body.textContent ?? "";
    } catch (e) {
      console.error("Error getting dialog content:", e);
      return "";
    }
  });
    log(LOG_LEVEL.INFO, "Currency dialog content:", dialogContent);

    // Try multiple approaches to select USD
    let isUsdSelected = await selectUsdInCurrencyDialog(this._page);

    // If approach 1 failed, try approach 2: Use Puppeteer's click method directly
    if (!isUsdSelected) {
      isUsdSelected = await this._tryAlternativeUsdSelection();
    }

    // Take a screenshot after selection attempt
    await takeScreenshot(this._page, "after-usd-selection-attempt");

    return isUsdSelected;
  }

  async _tryAlternativeUsdSelection(): Promise<boolean> {
    if (!this._page) throw new Error("Page not initialized");

    log(LOG_LEVEL.INFO, "First approach failed, trying direct Puppeteer click");

    // Try to find elements containing "US Dollar" or "USD" text using evaluate
  try {
    const isUsdElementFound = await this._page.evaluate((): boolean => {
      try {
        // Find all elements with text
        const allElements = Array.from(document.querySelectorAll('*'));

        // Find elements containing "US Dollar" or "USD" text
        for (const el of allElements) {
          const text = el.textContent?.trim();
          if (text && (text.includes('US Dollar') || text.includes('USD'))) {
            // Check if element is visible and clickable
            const rect = el.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 &&
                             window.getComputedStyle(el).display !== 'none';

            if (isVisible) {
              // Click the element
              (el as HTMLElement).click();
              return true;
            }
          }
        }

        return false;
      } catch (e) {
        console.error("Error finding USD element:", e);
        return false;
      }
    });

    return isUsdElementFound;
  } catch (error) {
    log(LOG_LEVEL.ERROR, "Error in alternative USD selection:", error);
    return false;
  }

  }

  async _finalizeCurrencySelection(): Promise<boolean> {
    if (!this._page) throw new Error("Page not initialized");

    log(LOG_LEVEL.INFO, "Selected USD in currency dialog");
    await takeScreenshot(this._page, "after-select-usd");

    // Wait a moment for the selection to register
    await this._page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

    // Try to find and click the Save/OK/Done button
    const isSaveButtonClicked = await clickSaveButtonInCurrencyDialog(this._page);

    if (isSaveButtonClicked) {
      log(LOG_LEVEL.INFO, "Clicked save/confirm button in currency dialog");
    } else {
      // If we couldn't find a save button, try pressing Enter
      log(LOG_LEVEL.WARN, "Could not find save button, trying to press Enter");
      await this._page.keyboard.press('Enter');
      log(LOG_LEVEL.INFO, "Pressed Enter key to confirm selection");
    }

    // Wait for the page to reload or update after currency change
    log(LOG_LEVEL.INFO, "Waiting for page to update after currency change");
    await this._page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));
    await takeScreenshot(this._page, "after-currency-change");

    // Reload the page to ensure the currency change takes effect
    log(LOG_LEVEL.INFO, "Reloading page to ensure currency change takes effect");
    await this._page.reload({ waitUntil: 'networkidle2' });
    await takeScreenshot(this._page, "after-reload");

    // Verify the currency was changed to USD
    const isCurrencyVerified = await verifyCurrencyChangeToUsd(this._page);

    if (isCurrencyVerified) {
      log(LOG_LEVEL.INFO, "Verified currency is now USD");
      return true;
    }

    log(LOG_LEVEL.WARN, "Could not verify currency change to USD");
    return false;
  }

  async changeCurrencyToUsd(): Promise<void> {
    if (!this._page) throw new Error("Page not initialized");

    log(LOG_LEVEL.INFO, "Changing currency to USD");

    try {
      // Take a screenshot before starting
      await takeScreenshot(this._page, "before-currency-change");

      // First, check if we're already using USD by looking for currency indicators
      const currentCurrency = await this._checkCurrentCurrency();

      if (currentCurrency === "USD") {
        log(LOG_LEVEL.INFO, "Currency is already set to USD");
        return;
      }

      // Look directly for the currency button on the page
      log(LOG_LEVEL.INFO, "Looking for currency button");
      await takeScreenshot(this._page, "before-finding-currency-button");

      // Find and click the currency button directly
      const isCurrencyButtonFound = await findAndClickCurrencyButton(this._page);

      if (isCurrencyButtonFound) {
        log(LOG_LEVEL.INFO, "Clicked on Currency option in menu");
        await takeScreenshot(this._page, "after-click-currency-option");

        // Handle the currency dialog
        const isUsdSelected = await this._handleCurrencyDialog();

        if (isUsdSelected) {
          // Finalize the currency selection
          const isSuccess = await this._finalizeCurrencySelection();
          if (!isSuccess) {
            log(LOG_LEVEL.WARN, "Currency change verification failed, but continuing");
          }
        } else {
          log(LOG_LEVEL.ERROR, "Could not find or select USD in currency dialog");
          throw new Error("Could not find or select USD in currency dialog");
        }
      } else {
        log(LOG_LEVEL.ERROR, "Could not find Currency option in menu");
        throw new Error("Could not find Currency option in menu");
      }
    } catch (error) {
      log(LOG_LEVEL.ERROR, "Error changing currency to USD:", error);
      await takeScreenshot(this._page, "error-changing-currency");
      throw error;
    }
  }

  async searchFlights(from: string, to: string, departureDate: string, returnDate?: string): Promise<{ success: boolean }> {
    if (!this._page) throw new Error("Page not initialized");

    log(LOG_LEVEL.INFO, `Searching flights from ${from} to ${to}`);
    const dateInfo = `Departure date: ${departureDate}`;
    const returnInfo = returnDate ? `, Return date: ${returnDate}` : "";
    log(LOG_LEVEL.INFO, dateInfo + returnInfo);

    // Take initial screenshot
    await takeScreenshot(this._page, "before-search");

    try {
      // Wait for the page to be fully loaded
      log(LOG_LEVEL.DEBUG, "Waiting for page to be fully loaded");
      await this._page.waitForSelector("body", { timeout: 10000 });

      // Log the current state of the page
      log(LOG_LEVEL.DEBUG, "Current page state before starting search");
      await logAllInputs(this._page);
      await logAllClickableElements(this._page);

      // Wait a bit for the page to be fully interactive
      await this._page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

      // Find and fill origin field
      await this._fillOriginField(from);

      // Wait for the page to stabilize after selecting origin
      await this._page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));

      // Find and fill destination field
      await this._fillDestinationField(to);

      // Return a simple result
      return { success: true };
    } catch (error) {
      log(LOG_LEVEL.ERROR, "Error searching flights:", error);
      await takeScreenshot(this._page, "error-searching-flights");
      throw error;
    }
  }

  private async _fillOriginField(from: string): Promise<void> {
    if (!this._page) throw new Error("Page not initialized");

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

    // Take a screenshot before finding origin field
    await takeScreenshot(this._page, "before-finding-origin-field");

    // Try to find the origin field
    let originField = null;
    for (const selector of possibleOriginSelectors) {
      log(LOG_LEVEL.DEBUG, `Trying origin selector: ${selector}`);
      try {
        const field = await this._page.$(selector);
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
      const inputFields = await this._page.$$('input, [role="combobox"], [contenteditable="true"]');
      log(LOG_LEVEL.DEBUG, `Found ${inputFields.length} potential input fields`);

      // Take a screenshot of all input fields
      await takeScreenshot(this._page, "all-input-fields");

      if (inputFields.length > 0) {
        // Use the first input field as the origin field
        originField = inputFields[0];
        log(LOG_LEVEL.INFO, "Using first input field as origin field");
      } else {
        log(LOG_LEVEL.ERROR, "Could not find any input fields");
        await takeScreenshot(this._page, "error-no-input-fields");
        throw new Error("Could not find any input fields");
      }
    }

    // Click on the origin field
    await originField.click();
    log(LOG_LEVEL.INFO, "Clicked on origin input field");
    await takeScreenshot(this._page, "after-click-origin-field");

    // Clear the origin field
    await this._page.keyboard.down("Control");
    await this._page.keyboard.press("a");
    await this._page.keyboard.up("Control");
    await this._page.keyboard.press("Backspace");

    // Type the origin
    await this._page.keyboard.type(from, { delay: 100 });
    log(LOG_LEVEL.INFO, `Typed origin: ${from}`);
    await takeScreenshot(this._page, "after-type-origin");

    // Wait for suggestions and select the first one
    await this._page
      .waitForSelector('[role="listbox"], [role="option"], .suggestions-list', { timeout: 5000 })
      .catch(() => log(LOG_LEVEL.WARN, "No suggestions dropdown found after typing origin"));

    // Take a screenshot of the suggestions
    await takeScreenshot(this._page, "origin-suggestions");

    // Press Enter to select the first suggestion
    await this._page.keyboard.press("Enter");
    log(LOG_LEVEL.INFO, "Pressed Enter to select origin");
    await takeScreenshot(this._page, "after-select-origin");
  }

  private async _fillDestinationField(to: string): Promise<void> {
    if (!this._page) throw new Error("Page not initialized");

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
    await takeScreenshot(this._page, "before-finding-destination-field");

    // Try to find the destination field
    let destinationField = null;
    for (const selector of possibleDestinationSelectors) {
      log(LOG_LEVEL.DEBUG, `Trying destination selector: ${selector}`);
      try {
        const field = await this._page.$(selector);
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
      const inputFields = await this._page.$$('input, [role="combobox"], [contenteditable="true"]');
      log(LOG_LEVEL.DEBUG, `Found ${inputFields.length} potential input fields`);

      // Take a screenshot of all input fields
      await takeScreenshot(this._page, "all-input-fields-for-destination");

      if (inputFields.length > 1) {
        // Use the second input field as the destination field
        destinationField = inputFields[1];
        log(LOG_LEVEL.INFO, "Using second input field as destination field");
      } else {
        log(LOG_LEVEL.ERROR, "Could not find enough input fields for destination");
        await takeScreenshot(this._page, "error-no-destination-field");
        throw new Error("Could not find destination field");
      }
    }

    // Click on the destination field
    await destinationField.click();
    log(LOG_LEVEL.INFO, "Clicked on destination input field");
    await takeScreenshot(this._page, "after-click-destination-field");

    // Clear the destination field
    await this._page.keyboard.down("Control");
    await this._page.keyboard.press("a");
    await this._page.keyboard.up("Control");
    await this._page.keyboard.press("Backspace");

    // Type the destination
    await this._page.keyboard.type(to, { delay: 100 });
    log(LOG_LEVEL.INFO, `Typed destination: ${to}`);
    await takeScreenshot(this._page, "after-type-destination");

    // Wait for suggestions and select the first one
    await this._page
      .waitForSelector('[role="listbox"], [role="option"], .suggestions-list', { timeout: 5000 })
      .catch(() => log(LOG_LEVEL.WARN, "No suggestions dropdown found after typing destination"));

    // Take a screenshot of the suggestions
    await takeScreenshot(this._page, "destination-suggestions");

    // Press Enter to select the first suggestion
    await this._page.keyboard.press("Enter");
    log(LOG_LEVEL.INFO, "Pressed Enter to select destination");
    await takeScreenshot(this._page, "after-select-destination");
  }

  async close(): Promise<void> {
    log(LOG_LEVEL.INFO, "Closing browser");
    if (this._browser) {
      await this._browser.close();
      this._browser = null;
      this._page = null;
    }
    log(LOG_LEVEL.INFO, "Browser closed");
  }
}
